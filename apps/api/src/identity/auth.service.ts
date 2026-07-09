import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { EmailService } from '../email/email.service';
import { CaptchaService } from '../common/captcha.service';
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
    private readonly captcha: CaptchaService,
  ) {}

  /**
   * STAKES/S-12 F-11 — 2xx-UNIFORM signup (full enumeration resistance).
   * Both paths return the identical `{ok:true}`: a new account is created
   * UNVERIFIED and receives the verification link; a duplicate email gets
   * the "someone tried to sign up with your email" notice to the real
   * owner. No session tokens here — the session is minted when the emailed
   * link is consumed (verifyEmail), which is what closes the enumeration
   * channel the old 409-vs-201 contract leaked through.
   */
  async signUp(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    next?: string;
    captchaToken?: string;
  }): Promise<{ ok: true }> {
    // STAKES/S-14 P3 — env-flagged bot gate (no-op until the key is set).
    await this.captcha.assertHuman(input.captchaToken, 'signup');
    const email = input.email.toLowerCase();
    const exists = await this.users.findByEmail(email);
    if (exists) {
      try {
        await this.email.duplicateSignup(email);
      } catch {
        /* best-effort — never block the response on email delivery */
      }
      return { ok: true };
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
        // BASELINE tier: unverified until the emailed link is clicked
        // (pre-0035 accounts were grandfathered true).
        emailVerified: false,
        // PDPL: consent version is stamped server-side; the DTO already
        // rejected any signup without acceptTerms=true.
        consentVersion: process.env.CONSENT_VERSION ?? '2026-06-28',
        consentAt: new Date(),
      },
    });
    await this.sendVerification(user.id, email, 'SIGNUP', null, input.next);
    return { ok: true };
  }

  // -- STAKES/S-12 F-11 — email verification (the baseline identity tier) ----

  /** Per-email resend cooldown (in-memory, v1 single-instance posture). */
  private readonly verifyCooldown = new Map<string, number>();
  private static readonly VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
  private static readonly RESEND_COOLDOWN_MS = 60 * 1000;

  private async sendVerification(
    userId: string,
    to: string,
    purpose: 'SIGNUP' | 'EMAIL_CHANGE',
    newEmail: string | null,
    next?: string,
  ): Promise<void> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.emailVerifyToken.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        purpose,
        newEmail,
        expiresAt: new Date(Date.now() + AuthService.VERIFY_TTL_MS),
      },
    });
    const base = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const link = `${base}/verify-email?token=${raw}${next ? `&next=${encodeURIComponent(next)}` : ''}`;
    try {
      if (purpose === 'EMAIL_CHANGE') await this.email.emailChangeVerify(to, link);
      else await this.email.verification(to, link);
    } catch {
      /* best-effort — the resend endpoint recovers a lost email */
    }
  }

  /**
   * Consume a one-time verification token.
   * SIGNUP → mark verified and mint the session (the link IS the login).
   * EMAIL_CHANGE (F-06) → apply the new address (uniqueness re-checked),
   * notify the OLD address, revoke other sessions (email is a JWT claim)
   * and re-issue for the caller.
   */
  async verifyEmail(rawToken: string): Promise<AuthResponse> {
    const row = await this.prisma.emailVerifyToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('invalid or expired verification token');
    }
    const user = await this.users.findById(row.userId);

    if (row.purpose === 'EMAIL_CHANGE' && row.newEmail) {
      const taken = await this.users.findByEmail(row.newEmail);
      if (taken && taken.id !== user.id) {
        // The address got registered between request and click — stay generic.
        throw new UnauthorizedException('invalid or expired verification token');
      }
      const oldEmail = user.email as string;
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id as string },
          data: { email: row.newEmail!, emailVerified: true },
        });
        await tx.emailVerifyToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
        await tx.refreshToken.updateMany({
          where: { userId: user.id as string, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
      try {
        await this.email.emailChanged(oldEmail, maskEmail(row.newEmail));
      } catch {
        /* best-effort */
      }
      return this.issue(user.id as string, row.newEmail, user.roles as UserRole[]);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id as string }, data: { emailVerified: true } });
      await tx.emailVerifyToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    });
    return this.issue(user.id as string, user.email as string, user.roles as UserRole[]);
  }

  /** Always `{ok:true}` (no enumeration); 60s per-email cooldown. */
  async resendVerification(email: string): Promise<{ ok: true }> {
    const key = email.toLowerCase();
    const last = this.verifyCooldown.get(key) ?? 0;
    if (Date.now() - last < AuthService.RESEND_COOLDOWN_MS) return { ok: true };
    this.verifyCooldown.set(key, Date.now());
    const user = await this.users.findByEmail(key);
    if (user && !user.emailVerified) {
      await this.sendVerification(user.id, key, 'SIGNUP', null);
    }
    return { ok: true };
  }

  async signIn(email: string, password: string, userAgent?: string): Promise<AuthResponse> {
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
    // STAKES/S-14 (P4-audit) — new-device notice, fire-and-forget.
    this.noteDevice(user.id, user.email, userAgent).catch(() => {});
    return this.issue(user.id, user.email, user.roles);
  }

  /**
   * STAKES/S-14 — "دخول من جهاز جديد": salted UA hash only (no IP/raw UA).
   * The FIRST device enrolls silently (a notice right after signup is
   * noise); notices start from the second distinct browser onward.
   */
  private async noteDevice(userId: string, email: string, userAgent?: string): Promise<void> {
    if (!userAgent) return;
    const salt = process.env.DEVICE_HASH_SALT ?? 'wathba-device-v1';
    const deviceHash = createHash('sha256').update(`${userAgent}|${salt}`).digest('hex');
    const existing = await this.prisma.knownDevice.findUnique({
      where: { userId_deviceHash: { userId, deviceHash } },
    });
    if (existing) {
      await this.prisma.knownDevice.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
      return;
    }
    const priorDevices = await this.prisma.knownDevice.count({ where: { userId } });
    await this.prisma.knownDevice.create({ data: { userId, deviceHash } });
    if (priorDevices > 0) {
      await this.email.newDeviceSignin(email);
    }
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
   * E1 + STAKES/S-12 F-06 — email change is now VERIFY-FIRST: after the
   * current-password check, a confirmation link goes to the NEW address and
   * the swap only happens when it's clicked (verifyEmail, purpose
   * EMAIL_CHANGE — which also notifies the OLD address and revokes other
   * sessions). Fully 2xx-uniform: a taken address gets the duplicate-signup
   * notice instead of a link, and the caller sees the same `{ok:true}`.
   */
  async changeEmail(
    userId: string,
    currentPassword: string,
    newEmail: string,
  ): Promise<{ ok: true }> {
    const email = newEmail.toLowerCase();
    const user = await this.users.findById(userId);
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('current password is incorrect');
    }
    const taken = await this.users.findByEmail(email);
    if (taken && taken.id !== userId) {
      try {
        await this.email.duplicateSignup(email);
      } catch {
        /* best-effort */
      }
      return { ok: true };
    }
    await this.sendVerification(userId, email, 'EMAIL_CHANGE', email);
    return { ok: true };
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
