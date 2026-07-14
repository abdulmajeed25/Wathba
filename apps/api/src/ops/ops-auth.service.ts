import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { authenticator } from 'otplib';
import type { OpsSession } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';

/**
 * OPS Part 1 — the SEPARATE admin session + step-up + TOTP.
 *
 * Posture:
 *  - Entering مركز العمليات is an explicit act («دخول إلى مركز العمليات»):
 *    an ADMIN with a normal public session must re-enter their password
 *    (and TOTP once enrolled). The ops session is an opaque random token —
 *    only its SHA-256 touches the database — with a 60-minute IDLE window
 *    and an 8-hour absolute cap, revocable, fully independent of the
 *    public JWT/refresh pair.
 *  - Step-up: MONEY and SENSITIVE operations require a password/TOTP
 *    re-entry within the last 10 minutes (`stepUpAt` on the session).
 *  - TOTP: mandatory-by-flag (OPS_TOTP_REQUIRED=1). While the flag is on
 *    and an admin has not enrolled, they may still ENTER (to enroll) but
 *    the session carries stepUpAt=NULL, so every MONEY/SENSITIVE operation
 *    is refused until TOTP exists. Backup codes: 10, hashed, single-use.
 *  - Anomaly logging: every failed enter/step-up/TOTP attempt is a loud log
 *    line AND an AuditLog row (`ops.auth.*.failed`).
 */

export const OPS_IDLE_MS = 60 * 60_000;
export const OPS_ABSOLUTE_MS = 8 * 60 * 60_000;
export const STEP_UP_WINDOW_MS = 10 * 60_000;

export interface OpsPrincipal {
  userId: string;
  email: string;
  roles: string[];
  session: OpsSession;
  totpEnabled: boolean;
  totpRequired: boolean;
}

@Injectable()
export class OpsAuthService {
  private readonly logger = new Logger(OpsAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cfg: ConfigService,
  ) {}

  private get totpRequired(): boolean {
    return this.cfg.get<string>('OPS_TOTP_REQUIRED') === '1';
  }

  /** AES-256-GCM key derived from JWT_SECRET — no new required env in dev. */
  private encKey(): Buffer {
    const secret = this.cfg.get<string>('JWT_SECRET') ?? 'dev-secret';
    return createHash('sha256').update(`${secret}:ops-totp`).digest();
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${enc.toString('hex')}`;
  }

  private decrypt(blob: string): string {
    const [ivH, tagH, encH] = blob.split('.');
    const decipher = createDecipheriv('aes-256-gcm', this.encKey(), Buffer.from(ivH!, 'hex'));
    decipher.setAuthTag(Buffer.from(tagH!, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encH!, 'hex')), decipher.final()]).toString(
      'utf8',
    );
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async anomaly(action: string, detail: Record<string, unknown>, actorId?: string) {
    this.logger.warn(`OPS AUTH ANOMALY ${action} ${JSON.stringify(detail)}`);
    await this.audit.log({ actorId, action, entity: 'OpsSession', detail });
  }

  /** Password check against the User row (bcrypt, same policy as sign-in). */
  private async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  /** TOTP or single-use backup code. Returns false when neither matches. */
  private async verifySecondFactor(userId: string, code: string): Promise<boolean> {
    const cred = await this.prisma.opsCredential.findUnique({ where: { userId } });
    if (!cred?.totpEnabledAt || !cred.totpSecretEnc) return false;
    const secret = this.decrypt(cred.totpSecretEnc);
    if (authenticator.verify({ token: code, secret })) return true;
    // Backup code path — constant-time compare against each stored hash,
    // consume on success.
    const given = Buffer.from(this.hash(code.trim().toLowerCase()));
    for (const h of cred.backupCodeHashes) {
      const want = Buffer.from(h);
      if (given.length === want.length && timingSafeEqual(given, want)) {
        await this.prisma.opsCredential.update({
          where: { userId },
          data: { backupCodeHashes: cred.backupCodeHashes.filter((x) => x !== h) },
        });
        this.logger.warn(`ops backup code consumed user=${userId} remaining=${cred.backupCodeHashes.length - 1}`);
        return true;
      }
    }
    return false;
  }

  private async totpEnabled(userId: string): Promise<boolean> {
    const cred = await this.prisma.opsCredential.findUnique({ where: { userId } });
    return !!cred?.totpEnabledAt;
  }

  /**
   * «دخول إلى مركز العمليات» — explicit entry from an authenticated ADMIN.
   * Password always; TOTP when enrolled (or required-and-enrolled). When
   * OPS_TOTP_REQUIRED=1 and the admin has NOT enrolled yet, entry succeeds
   * with stepUpAt=NULL: they can browse /ops and enroll, nothing more.
   */
  async enter(input: {
    userId: string;
    email: string;
    roles: string[];
    password: string;
    totp?: string;
    ip?: string;
  }): Promise<{ token: string; expiresAt: Date; totpPending: boolean }> {
    if (!(await this.verifyPassword(input.userId, input.password))) {
      await this.anomaly('ops.auth.enter.failed', { reason: 'bad-password', ip: input.ip ?? null }, input.userId);
      throw new UnauthorizedException('كلمة المرور غير صحيحة');
    }
    const enrolled = await this.totpEnabled(input.userId);
    if (enrolled) {
      if (!input.totp || !(await this.verifySecondFactor(input.userId, input.totp))) {
        await this.anomaly('ops.auth.enter.failed', { reason: 'bad-totp', ip: input.ip ?? null }, input.userId);
        throw new UnauthorizedException('رمز التحقق الثنائي غير صحيح');
      }
    }
    const totpPending = this.totpRequired && !enrolled;

    const raw = randomBytes(48).toString('hex');
    const now = new Date();
    await this.prisma.opsSession.create({
      data: {
        userId: input.userId,
        tokenHash: this.hash(raw),
        // TOTP pending → no step-up until the second factor exists.
        stepUpAt: totpPending ? null : now,
        ip: input.ip ?? null,
      },
    });
    await this.audit.log({
      actorId: input.userId,
      action: 'ops.auth.enter',
      entity: 'OpsSession',
      detail: { ip: input.ip ?? null, totpPending },
    });
    return { token: raw, expiresAt: new Date(now.getTime() + OPS_ABSOLUTE_MS), totpPending };
  }

  /**
   * Resolve an ops token → live principal. Slides the idle window.
   * Throws 401 (Arabic) on unknown/expired/revoked.
   */
  async resolve(rawToken: string): Promise<OpsPrincipal> {
    const session = await this.prisma.opsSession.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    const now = Date.now();
    if (
      !session ||
      session.revokedAt ||
      now - session.lastSeenAt.getTime() > OPS_IDLE_MS ||
      now - session.createdAt.getTime() > OPS_ABSOLUTE_MS
    ) {
      throw new UnauthorizedException('جلسة مركز العمليات منتهية — ادخل مجدداً');
    }
    // Slide the idle window (throttled to one write a minute).
    if (now - session.lastSeenAt.getTime() > 60_000) {
      await this.prisma.opsSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, roles: true },
    });
    if (!user || !(user.roles as string[]).includes('ADMIN')) {
      // Role revoked mid-session → the ops session dies with it, instantly.
      await this.prisma.opsSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('صلاحية المشرف أُلغيت — الجلسة أُنهيت');
    }
    return {
      userId: session.userId,
      email: user.email,
      roles: user.roles as string[],
      session,
      totpEnabled: await this.totpEnabled(session.userId),
      totpRequired: this.totpRequired,
    };
  }

  /** Fresh password (+TOTP when enrolled) re-entry → step-up for 10 minutes. */
  async stepUp(p: OpsPrincipal, password: string, totp?: string, ip?: string): Promise<Date> {
    if (!(await this.verifyPassword(p.userId, password))) {
      await this.anomaly('ops.auth.stepup.failed', { reason: 'bad-password', ip: ip ?? null }, p.userId);
      throw new UnauthorizedException('كلمة المرور غير صحيحة');
    }
    if (p.totpEnabled) {
      if (!totp || !(await this.verifySecondFactor(p.userId, totp))) {
        await this.anomaly('ops.auth.stepup.failed', { reason: 'bad-totp', ip: ip ?? null }, p.userId);
        throw new UnauthorizedException('رمز التحقق الثنائي غير صحيح');
      }
    } else if (p.totpRequired) {
      throw new ForbiddenException(
        'التحقق الثنائي إلزامي لهذا الحساب — فعّله من صفحة مركز العمليات أولاً',
      );
    }
    const now = new Date();
    await this.prisma.opsSession.update({
      where: { id: p.session.id },
      data: { stepUpAt: now },
    });
    await this.audit.log({ actorId: p.userId, action: 'ops.auth.stepup', entity: 'OpsSession' });
    return now;
  }

  /**
   * Legacy-seam helper: the old admin endpoints (kept for the pre-ops admin
   * screen + e2e) may carry `x-ops-token` to satisfy the MONEY step-up rule.
   * Absent or dead token → null (the registry then refuses with the Arabic
   * step-up message rather than a raw 401).
   */
  async stepUpFromToken(rawToken?: string): Promise<Date | null> {
    if (!rawToken) return null;
    try {
      const p = await this.resolve(rawToken);
      return p.session.stepUpAt;
    } catch {
      return null;
    }
  }

  async leave(p: OpsPrincipal): Promise<void> {
    await this.prisma.opsSession.update({
      where: { id: p.session.id },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ actorId: p.userId, action: 'ops.auth.leave', entity: 'OpsSession' });
  }

  /* ── TOTP enrollment ─────────────────────────────────────────────────── */

  /** Start enrollment: fresh secret (password-gated). Confirm to activate. */
  async totpSetup(p: OpsPrincipal, password: string): Promise<{ secret: string; otpauth: string }> {
    if (!(await this.verifyPassword(p.userId, password))) {
      await this.anomaly('ops.auth.totp-setup.failed', { reason: 'bad-password' }, p.userId);
      throw new UnauthorizedException('كلمة المرور غير صحيحة');
    }
    const secret = authenticator.generateSecret();
    await this.prisma.opsCredential.upsert({
      where: { userId: p.userId },
      create: { userId: p.userId, totpSecretEnc: this.encrypt(secret) },
      // Re-setup before confirm replaces the pending secret; an ENABLED
      // credential must be disabled first (explicit, audited).
      update: p.totpEnabled ? {} : { totpSecretEnc: this.encrypt(secret) },
    });
    if (p.totpEnabled) {
      throw new ForbiddenException('التحقق الثنائي مفعّل بالفعل — عطّله أولاً لإعادة الإعداد');
    }
    const otpauth = authenticator.keyuri(p.email, 'Wathba Ops', secret);
    return { secret, otpauth };
  }

  /** Confirm with a live code → enable + mint 10 single-use backup codes. */
  async totpConfirm(p: OpsPrincipal, code: string): Promise<{ backupCodes: string[] }> {
    const cred = await this.prisma.opsCredential.findUnique({ where: { userId: p.userId } });
    if (!cred?.totpSecretEnc || cred.totpEnabledAt) {
      throw new ForbiddenException('لا إعداد تحقق ثنائي معلّقاً — ابدأ الإعداد أولاً');
    }
    const secret = this.decrypt(cred.totpSecretEnc);
    if (!authenticator.verify({ token: code, secret })) {
      await this.anomaly('ops.auth.totp-confirm.failed', {}, p.userId);
      throw new UnauthorizedException('رمز التحقق غير صحيح — تأكد من ساعة الجهاز');
    }
    const backupCodes = Array.from({ length: 10 }, () => randomBytes(4).toString('hex'));
    await this.prisma.opsCredential.update({
      where: { userId: p.userId },
      data: {
        totpEnabledAt: new Date(),
        backupCodeHashes: backupCodes.map((c) => this.hash(c)),
      },
    });
    // Enrollment completes the second factor for THIS session too.
    await this.prisma.opsSession.update({
      where: { id: p.session.id },
      data: { stepUpAt: new Date() },
    });
    await this.audit.log({ actorId: p.userId, action: 'ops.auth.totp-enabled', entity: 'OpsCredential' });
    return { backupCodes };
  }

  /** Disable (password + live code) — audited; sessions keep working. */
  async totpDisable(p: OpsPrincipal, password: string, code: string): Promise<void> {
    if (!(await this.verifyPassword(p.userId, password))) {
      throw new UnauthorizedException('كلمة المرور غير صحيحة');
    }
    if (!(await this.verifySecondFactor(p.userId, code))) {
      await this.anomaly('ops.auth.totp-disable.failed', {}, p.userId);
      throw new UnauthorizedException('رمز التحقق غير صحيح');
    }
    if (this.totpRequired) {
      throw new ForbiddenException('التحقق الثنائي إلزامي بسياسة المنصة (OPS_TOTP_REQUIRED) — لا يمكن تعطيله');
    }
    await this.prisma.opsCredential.update({
      where: { userId: p.userId },
      data: { totpSecretEnc: null, totpEnabledAt: null, backupCodeHashes: [] },
    });
    await this.audit.log({ actorId: p.userId, action: 'ops.auth.totp-disabled', entity: 'OpsCredential' });
  }
}
