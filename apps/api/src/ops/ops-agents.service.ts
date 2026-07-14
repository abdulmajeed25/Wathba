import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { AgentAccount } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * OPS Part 4 — agent identity. Owns the governance tables AgentAccount +
 * AgentDryRun (the RULE-4/5 carve-out); creation/rotation/disabling flow
 * through the agents.* OPERATIONS, this service only resolves tokens and
 * keeps the no-blind-writes ledger.
 *
 * Hard posture, enforced here and in the registry — never by prompt:
 *  · AGENTS_ENABLED='false'|'0' kills EVERY agent token instantly.
 *  · Tokens are opaque (SHA-256 stored), expire (default 24h), rotatable.
 *  · Per-agent rate limit (in-memory window; AGENT_RATE_LIMIT_PER_MIN).
 *  · An agent execution requires a preceding successful dryRun whose
 *    inputHash matches, within DRYRUN_FRESHNESS_MS.
 */

export const AGENT_TOKEN_TTL_MS = 24 * 60 * 60_000;
export const DRYRUN_FRESHNESS_MS = 15 * 60_000;

export interface AgentPrincipal {
  agent: AgentAccount;
  roleKey: string;
  permissions: string[];
}

@Injectable()
export class OpsAgentsService {
  private readonly logger = new Logger(OpsAgentsService.name);
  /** agentId → request timestamps inside the current window. */
  private readonly windows = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  get enabled(): boolean {
    const v = this.cfg.get<string>('AGENTS_ENABLED');
    return v !== 'false' && v !== '0';
  }

  private get ratePerMin(): number {
    return Number(this.cfg.get<string>('AGENT_RATE_LIMIT_PER_MIN') ?? 60);
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  mintToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = `wagent_${randomBytes(32).toString('hex')}`;
    return { raw, hash: this.hash(raw), expiresAt: new Date(Date.now() + AGENT_TOKEN_TTL_MS) };
  }

  /** Token → live agent principal. Kill switch first, then account state. */
  async resolve(rawToken: string): Promise<AgentPrincipal> {
    if (!this.enabled) {
      this.logger.warn('agent token presented while AGENTS_ENABLED is off');
      throw new ForbiddenException('واجهة الوكلاء موقوفة (AGENTS_ENABLED) — كل الرموز معطّلة');
    }
    const agent = await this.prisma.agentAccount.findUnique({
      where: { tokenHash: this.hash(rawToken) },
      include: { role: { select: { key: true, permissions: true } } },
    });
    if (!agent || !agent.isActive) {
      throw new UnauthorizedException('رمز وكيل غير صالح أو معطّل');
    }
    if (!agent.tokenExpiresAt || agent.tokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('رمز الوكيل منتهي — لُفَّ الرمز من مركز العمليات');
    }
    this.assertRate(agent.id);
    // Throttled last-seen stamp (one write a minute).
    if (!agent.lastUsedAt || Date.now() - agent.lastUsedAt.getTime() > 60_000) {
      await this.prisma.agentAccount
        .update({ where: { id: agent.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }
    return { agent, roleKey: agent.role.key, permissions: agent.role.permissions };
  }

  private assertRate(agentId: string): void {
    const now = Date.now();
    const windowStart = now - 60_000;
    const stamps = (this.windows.get(agentId) ?? []).filter((t) => t > windowStart);
    if (stamps.length >= this.ratePerMin) {
      this.logger.warn(`agent ${agentId} rate-limited (${stamps.length}/${this.ratePerMin} per min)`);
      throw new ForbiddenException('تجاوز الوكيل حد الطلبات — انتظر دقيقة');
    }
    stamps.push(now);
    this.windows.set(agentId, stamps);
  }

  /* ── the no-blind-writes ledger ──────────────────────────────────────── */

  async recordDryRun(agentId: string, operationKey: string, inputHash: string, ok: boolean): Promise<void> {
    await this.prisma.agentDryRun.create({ data: { agentId, operationKey, inputHash, ok } });
  }

  async hasFreshDryRun(agentId: string, operationKey: string, inputHash: string): Promise<boolean> {
    const row = await this.prisma.agentDryRun.findFirst({
      where: {
        agentId,
        operationKey,
        inputHash,
        ok: true,
        createdAt: { gte: new Date(Date.now() - DRYRUN_FRESHNESS_MS) },
      },
      select: { id: true },
    });
    return !!row;
  }

  /* ── reads for the «الوكلاء» screen ──────────────────────────────────── */

  async list() {
    const agents = await this.prisma.agentAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: { role: { select: { key: true, nameAr: true } } },
    });
    return agents.map((a) => ({
      id: a.id,
      nameAr: a.nameAr,
      isActive: a.isActive,
      roleKey: a.role.key,
      roleNameAr: a.role.nameAr,
      hasToken: !!a.tokenHash,
      tokenExpiresAt: a.tokenExpiresAt,
      lastUsedAt: a.lastUsedAt,
      createdAt: a.createdAt,
    }));
  }
}
