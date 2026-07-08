import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { EmailService } from '../email/email.service';
import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
}

export interface AuthResponse {
  accessToken: string;
  /** Rotating refresh token (Sprint 2 / P1-502) — httpOnly-cookie material. */
  refreshToken: string;
  user: Record<string, unknown>;
}

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Per-email login back-off. Hard-coded (no DB / no Redis) for v1: each API
 * process keeps its own in-memory map. That's intentional — at this scale a
 * single API instance handles all auth traffic; a distributed lockout would
 * be Tier 2/3 work. Resets the slot after `LOCKOUT_WINDOW_MS` so a typo'd
 * email isn't permanently locked.
 */
const LOGIN_FAIL_LIMIT = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly failedAttempts = new Map<string, { count: number; firstAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  async signUp(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const exists = await this.users.findByEmail(email);
    if (exists) {
      // STAKES/P1 — enumeration resistance: the requester gets a GENERIC 409
      // (never "already registered") while the real owner is notified by
      // email. Full uniformity (identical 2xx for both paths) needs the
      // verify-email-before-login flow (A5) — documented deferral.
      try {
        await this.email.duplicateSignup(email);
      } catch {
        /* best-effort — never block the response on email delivery */
      }
      throw new ConflictException('unable to create an account with these details');
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    // STAKES/C7 — mint a unique public handle from the email local-part
    // (null when it sanitizes too short; the user picks one in settings).
    const handle = await this.users.generateHandle(email);
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        phone: input.phone,
        handle,
        roles: ['BACKER'],
        // PDPL: consent version is stamped server-side; the DTO already
        // rejected any signup without acceptTerms=true.
        consentVersion: process.env.CONSENT_VERSION ?? '2026-06-28',
        consentAt: new Date(),
      },
    });
    return this.issue(user.id, email, user.roles);
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const key = email.toLowerCase();
    this.checkLockout(key);
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) {
      this.recordFailure(key);
      throw new UnauthorizedException('invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      this.recordFailure(key);
      throw new UnauthorizedException('invalid credentials');
    }
    // Success — clear the per-email counter.
    this.failedAttempts.delete(key);
    return this.issue(user.id, user.email, user.roles);
  }

  /** Throws 429 with Retry-After if this email has hit LOGIN_FAIL_LIMIT. */
  private checkLockout(key: string): void {
    const slot = this.failedAttempts.get(key);
    if (!slot) return;
    const elapsed = Date.now() - slot.firstAt;
    if (elapsed >= LOCKOUT_WINDOW_MS) {
      this.failedAttempts.delete(key);
      return;
    }
    if (slot.count >= LOGIN_FAIL_LIMIT) {
      const retryAfterSec = Math.ceil((LOCKOUT_WINDOW_MS - elapsed) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many failed sign-in attempts. Try again in ${retryAfterSec}s.`,
          retryAfter: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(key: string): void {
    const slot = this.failedAttempts.get(key);
    if (!slot || Date.now() - slot.firstAt >= LOCKOUT_WINDOW_MS) {
      this.failedAttempts.set(key, { count: 1, firstAt: Date.now() });
      return;
    }
    slot.count += 1;
  }

  private async issue(sub: string, email: string, roles: UserRole[]): Promise<AuthResponse> {
    const payload: JwtPayload = { sub, email, roles };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.mintRefreshToken(sub);
    const user = await this.users.findById(sub);
    return { accessToken, refreshToken, user: this.users.toPublic(user) };
  }

  // -- STAKES/E1 E5 — account security operations ------------------------------

  /**
   * E1 + A12 — password change with current-password check. Revokes every
   * refresh token (other devices die at access-token expiry, ≤1h) and sends
   * a security notice. The caller's own session cookie pair is re-issued by
   * the web layer right after.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true; refreshToken: string }> {
    const user = await this.users.findById(userId);
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // A12 — invalidate every other session.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const refreshToken = await this.mintRefreshToken(userId);
    try {
      await this.email.passwordChanged(user.email);
    } catch {
      /* best-effort */
    }
    return { ok: true, refreshToken };
  }

  /**
   * E1 — email change with current-password check. Generic 409 on a taken
   * address (enumeration resistance, same policy as signup) + a security
   * notice to the OLD address.
   */
  async changeEmail(
    userId: string,
    currentPassword: string,
    newEmail: string,
  ): Promise<{ ok: true; accessToken: string }> {
    const email = newEmail.toLowerCase();
    const user = await this.users.findById(userId);
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('current password is incorrect');
    }
    const taken = await this.users.findByEmail(email);
    if (taken && taken.id !== userId) {
      throw new ConflictException('unable to use this email');
    }
    const oldEmail = user.email;
    await this.prisma.user.update({ where: { id: userId }, data: { email } });
    try {
      await this.email.emailChanged(oldEmail, maskEmail(email));
    } catch {
      /* best-effort */
    }
    // The JWT carries the email claim — issue a fresh access token.
    const accessToken = await this.jwt.signAsync({
      sub: userId,
      email,
      roles: user.roles,
    } satisfies JwtPayload);
    return { ok: true, accessToken };
  }

  /** E5 — revoke every refresh token ("sign out all devices"). */
  async signOutAll(userId: string): Promise<{ revoked: number }> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: count };
  }

  // -- Refresh rotation (Sprint 2 / P1-502) -----------------------------------

  private async mintRefreshToken(userId: string, replacesId?: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const row = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    if (replacesId) {
      await this.prisma.refreshToken.update({
        where: { id: replacesId },
        data: { revokedAt: new Date(), replacedById: row.id },
      });
    }
    return raw;
  }

  /**
   * Rotate: a valid refresh token yields a fresh access + refresh pair and
   * revokes itself. Presenting an ALREADY-ROTATED token is a replay signal —
   * every session for that user is revoked and the caller gets 401.
   */
  async refresh(rawToken: string): Promise<AuthResponse> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!row) throw new UnauthorizedException('invalid refresh token');
    if (row.revokedAt) {
      // Replay of a rotated token → assume theft, kill all sessions.
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('refresh token reuse detected — all sessions revoked');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('refresh token expired');
    }
    const user = await this.users.findById(row.userId);
    const payload: JwtPayload = { sub: user.id, email: user.email, roles: user.roles };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.mintRefreshToken(user.id, row.id);
    return { accessToken, refreshToken, user: this.users.toPublic(user) };
  }

  // -- Password recovery (Sprint 3 / P1-206) ----------------------------------

  /**
   * Always resolves success-shaped — never reveals whether the email exists
   * (user-enumeration defense). When a mailer is configured (MAILER_API_KEY)
   * the reset link goes out by email; in dev/stub it is logged.
   */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (!user) return { ok: true };
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    const link = `${process.env.WEB_BASE_URL ?? 'http://localhost:3000'}/reset-password?token=${raw}`;
    // STAKES/S-3/A11 — actually send the reset link (stub logs in dev; never
    // throws, preserving the always-200 no-enumeration contract).
    await this.email.passwordReset(user.email, link);
    return { ok: true };
  }

  /** One-time token → new password; revokes every session on success. */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ ok: true }> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('invalid or expired reset token');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      // Stolen-session defense: a password reset invalidates every device.
      await tx.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }

  /** Sign-out: revoke this refresh token (idempotent). */
  async signOut(rawToken: string): Promise<{ revoked: boolean }> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: count > 0 };
  }
}

/** sara@example.sa → s***@example.sa (notice-safe). */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${(local ?? '').slice(0, 1)}***@${domain ?? ''}`;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
