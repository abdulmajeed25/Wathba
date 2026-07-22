import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { AuditService } from '../../identity/audit.service';
import type { OpsPrincipal } from '../ops-auth.service';
import { OpsReadService } from '../read/ops-read.service';

/**
 * OPS-360 Unit-2 — READ-ONLY "view-as" impersonation.
 *
 * WHY THIS SERVICE EXISTS (and why it is NOT a registry operation): a support
 * operator sometimes needs to see the product AS a user to diagnose a report.
 * That is a governed, audited act, but it is NOT a business-entity mutation —
 * it grants a time-boxed READ-ONLY view and nothing more. It therefore lives
 * outside the OpRunner registry, like the audit browser and the read layer.
 *
 * DECISION — snapshot, not a session swap. A real cookie-level impersonated
 * public session (minting a public JWT for the target user) is large and
 * dangerous: it would hand the operator the user's live, WRITE-capable app.
 * Instead this mints a short-lived (15-min) signed opaque handle and exposes a
 * READ-ONLY snapshot of the target's public-facing data
 * (OpsReadService.viewAsSnapshot). The handle grants NO write/op capability of
 * any kind — there is no code path from it to a mutation. Full cookie-level
 * impersonation is a documented follow-up.
 *
 * GOVERNANCE — this service injects NO PrismaService. All reads route through
 * the carved-out OpsReadService; the ONLY write is an AuditLog row via the
 * append-only AuditService (identity), never a business entity. It therefore
 * needs no RULE-4/5 carve-out in ops-governance.spec (RULE 4 flags PrismaService
 * injection inside src/ops; this file injects none).
 *
 * REVOCATION — the handle is stateless (self-signed, no DB row), so `stop`
 * records the audit checkpoint AND drops the handle's jti into an in-process
 * revoked set (hard-stops within this instance). Across instances / restarts
 * the 15-minute expiry is the backstop. A durable revocation store is a
 * follow-up alongside the full session-swap.
 */

const TTL_MS = 15 * 60_000;

interface ImpersonationClaims {
  jti: string;
  /** subject — the impersonated User id. */
  sub: string;
  /** operator — the ops User id who started it. */
  op: string;
  iat: number;
  exp: number;
}

export interface ImpersonationStart {
  handle: string;
  userId: string;
  expiresAt: string;
  readOnly: true;
}

@Injectable()
export class ImpersonationService {
  private readonly logger = new Logger(ImpersonationService.name);
  /** Process-local hard revocation for `stop` (see class doc). */
  private readonly revoked = new Set<string>();

  constructor(
    private readonly read: OpsReadService,
    private readonly audit: AuditService,
    private readonly cfg: ConfigService,
  ) {}

  /** OWNER-only gate — the whole flow requires the '*' wildcard permission. */
  assertOwner(principal: OpsPrincipal): void {
    if (!principal.permissions.includes('*')) {
      throw new ForbiddenException('انتحال العرض مقصور على المالك (OWNER) فقط');
    }
  }

  private signingKey(): Buffer {
    const secret = this.cfg.get<string>('JWT_SECRET') ?? 'dev-secret';
    return createHash('sha256').update(`${secret}:ops-impersonation`).digest();
  }

  private sign(claims: ImpersonationClaims): string {
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const sig = createHmac('sha256', this.signingKey()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  /** Verify signature, expiry and revocation. Throws the Arabic 403 on any fault. */
  private verifyHandle(handle: string | undefined): ImpersonationClaims {
    if (!handle) throw new ForbiddenException('مطلوب مِقبض انتحال ساري');
    const [body, sig] = handle.split('.');
    if (!body || !sig) throw new ForbiddenException('مِقبض الانتحال غير صالح');
    const expected = createHmac('sha256', this.signingKey()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('توقيع مِقبض الانتحال غير صحيح');
    }
    let claims: ImpersonationClaims;
    try {
      claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ImpersonationClaims;
    } catch {
      throw new ForbiddenException('مِقبض الانتحال تالف');
    }
    if (Date.now() > claims.exp) throw new ForbiddenException('انتهت صلاحية مِقبض الانتحال');
    if (this.revoked.has(claims.jti)) throw new ForbiddenException('أُنهي مِقبض الانتحال');
    return claims;
  }

  /**
   * Begin a READ-ONLY view-as session. Validates the target exists (via the
   * read layer — throws NotFound if not), mints a 15-min handle, and writes the
   * governed `ops.impersonation.start` audit row (actor=operator, subject=User).
   */
  async start(operator: OpsPrincipal, userId: string, reason: string, ip?: string): Promise<ImpersonationStart> {
    this.assertOwner(operator);
    if (!userId || typeof userId !== 'string') {
      throw new ForbiddenException('مطلوب معرّف المستخدم المستهدف');
    }
    if (!reason || reason.trim().length < 5) {
      throw new ForbiddenException('انتحال العرض يتطلب سبباً مكتوباً (٥ أحرف على الأقل)');
    }
    // Existence + read-only sanity: NotFound if the subject is unknown.
    await this.read.userDetail(userId);

    const now = Date.now();
    const jti = createHash('sha256')
      .update(`${operator.userId}:${userId}:${now}:${Math.random()}`)
      .digest('hex')
      .slice(0, 32);
    const claims: ImpersonationClaims = { jti, sub: userId, op: operator.userId, iat: now, exp: now + TTL_MS };
    const handle = this.sign(claims);

    await this.audit.log({
      actorId: operator.userId,
      action: 'ops.impersonation.start',
      entity: 'User',
      entityId: userId,
      detail: { reason: reason.trim(), jti, ip: ip ?? null, expiresAt: new Date(claims.exp).toISOString(), readOnly: true },
    });
    this.logger.warn(`IMPERSONATION START operator=${operator.userId} subject=${userId} jti=${jti}`);

    return { handle, userId, expiresAt: new Date(claims.exp).toISOString(), readOnly: true };
  }

  /**
   * End a view-as session — verifies the handle, hard-revokes its jti in-process
   * and writes the `ops.impersonation.stop` audit row.
   */
  async stop(operator: OpsPrincipal, handle: string, reason: string | undefined, ip?: string): Promise<{ stopped: true }> {
    this.assertOwner(operator);
    const claims = this.verifyHandle(handle);
    this.revoked.add(claims.jti);
    await this.audit.log({
      actorId: operator.userId,
      action: 'ops.impersonation.stop',
      entity: 'User',
      entityId: claims.sub,
      detail: { reason: reason?.trim() ?? null, jti: claims.jti, ip: ip ?? null },
    });
    this.logger.warn(`IMPERSONATION STOP operator=${operator.userId} subject=${claims.sub} jti=${claims.jti}`);
    return { stopped: true };
  }

  /**
   * Return the READ-ONLY snapshot for an active view-as session. Requires a
   * valid, unexpired, unrevoked handle whose subject matches the requested
   * userId — you cannot view a user you did not `start` against. The access is
   * itself audited (`ops.impersonation.view`) since it discloses product data.
   */
  async view(operator: OpsPrincipal, userId: string, handle: string | undefined, ip?: string) {
    this.assertOwner(operator);
    const claims = this.verifyHandle(handle);
    if (claims.sub !== userId) {
      throw new ForbiddenException('مِقبض الانتحال لا يطابق المستخدم المطلوب');
    }
    const snapshot = await this.read.viewAsSnapshot(userId);
    await this.audit.log({
      actorId: operator.userId,
      action: 'ops.impersonation.view',
      entity: 'User',
      entityId: userId,
      detail: { jti: claims.jti, ip: ip ?? null },
    });
    return snapshot;
  }
}
