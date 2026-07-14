import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import {
  MONEY_PERMISSIONS,
  holdsMoneyPermission,
  permissionMatches,
} from './permissions';
import type {
  FourEyesPort,
  OperationActor,
  OperationContext,
  PermissionPort,
  RiskTier,
} from './operation.types';

/**
 * OPS Part 2 — RBAC + the four-eyes switch. This service OWNS the governance
 * tables OpsRole/OpsRoleGrant (the same carve-out ops-auth.service.ts has
 * for OpsSession/OpsCredential — governance infrastructure, never a business
 * entity) and implements the registry's PermissionPort and FourEyesPort.
 *
 * Four-eyes semantics (owner decision, locked):
 *  - While EXACTLY ONE money admin exists (single-operator mode) the flag
 *    follows config: FOUR_EYES_MONEY=1 turns the queue on voluntarily.
 *  - The moment a SECOND user holds any money permission ('*',
 *    money.execute, money.approve) the queue turns ON automatically and NO
 *    UI can turn it off — there is deliberately no operation that writes
 *    this flag. The only override is the env FOUR_EYES_MONEY_OVERRIDE=off,
 *    which is error-logged on EVERY evaluation, loudly.
 */
@Injectable()
export class OpsRbacService implements PermissionPort, FourEyesPort {
  private readonly logger = new Logger(OpsRbacService.name);
  private legacyWarned = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  /* ── PermissionPort ──────────────────────────────────────────────────── */

  has(actor: OperationActor, permission: string): boolean {
    if (actor.permissions) {
      return permissionMatches(actor.permissions, permission);
    }
    // Legacy net: a first-party caller that predates Part 2 and never
    // resolved permissions. Every governed controller attaches them now;
    // anything landing here is a seam to fix, so warn loudly (once).
    if (actor.type === 'HUMAN' && actor.roles.includes('ADMIN')) {
      if (!this.legacyWarned) {
        this.legacyWarned = true;
        this.logger.warn(
          `RBAC legacy fallback used (actor=${actor.id}, permission=${permission}) — ` +
            'a caller invoked the registry without resolving OpsRoleGrant permissions; ' +
            'ADMIN allowed until Part 5 retires the seams',
        );
      }
      return true;
    }
    return false;
  }

  /** Union of the user's granted role permissions — resolved at auth time
   *  and attached to the actor, so the port itself stays synchronous. */
  async permissionsForUser(userId: string): Promise<{ roleKeys: string[]; permissions: string[] }> {
    const grants = await this.prisma.opsRoleGrant.findMany({
      where: { userId },
      select: { role: { select: { key: true, permissions: true } } },
    });
    const roleKeys = grants.map((g) => g.role.key).sort();
    const permissions = [...new Set(grants.flatMap((g) => g.role.permissions))].sort();
    return { roleKeys, permissions };
  }

  hasMoneyPermission(permissions: readonly string[]): boolean {
    return holdsMoneyPermission(permissions);
  }

  /* ── FourEyesPort ────────────────────────────────────────────────────── */

  async mustQueue(tier: RiskTier, _ctx: OperationContext): Promise<boolean> {
    if (tier !== 'MONEY') return false;
    return this.fourEyesEffective();
  }

  /** Distinct users holding any money permission — queried live: money
   *  operations are rare and the count must never be stale. */
  async moneyAdminCount(): Promise<number> {
    const roles = await this.prisma.opsRole.findMany({
      where: { permissions: { hasSome: [...MONEY_PERMISSIONS] } },
      select: { grants: { select: { userId: true } } },
    });
    return new Set(roles.flatMap((r) => r.grants.map((g) => g.userId))).size;
  }

  async fourEyesEffective(): Promise<boolean> {
    const count = await this.moneyAdminCount();
    if (count >= 2) {
      if (this.cfg.get<string>('FOUR_EYES_MONEY_OVERRIDE') === 'off') {
        this.logger.error(
          `FOUR_EYES_MONEY forcibly DISABLED by env override while ${count} money admins exist — ` +
            'this removes the second pair of eyes on every payout; remove FOUR_EYES_MONEY_OVERRIDE now',
        );
        return false;
      }
      return true;
    }
    return this.cfg.get<string>('FOUR_EYES_MONEY') === '1';
  }
}
