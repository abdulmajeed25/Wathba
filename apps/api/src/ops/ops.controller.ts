import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { OperationsRegistry } from './operations.registry';
import type { OperationContext } from './operation.types';
import { OpsIpAllowlistGuard } from './ops-session.guard';
import { OpsOperationsGuard } from './ops-agents.guard';
import type { OpsPrincipal } from './ops-auth.service';
import type { AgentPrincipal } from './ops-agents.service';

type OpsRequest = Request & { opsPrincipal?: OpsPrincipal; agentPrincipal?: AgentPrincipal };

/**
 * OPS Part 0/1/2/4 — the registry's HTTP surface:
 *   GET  /v1/ops/operations            machine-readable capability manifest
 *   GET  /v1/ops/operations/:key       describe one operation
 *   POST /v1/ops/operations/:key/dry-run
 *   POST /v1/ops/operations/:key/execute
 *   POST /v1/ops/operations/:key/propose   (Part 4 — SENSITIVE/MONEY → queue)
 *
 * Two principals (Part 4): a human ops session (x-ops-token) or an agent
 * service token (x-agent-token). The registry enforces what each may do —
 * an agent's MONEY/SENSITIVE executes are refused there regardless of role,
 * and its CONTENT/STANDARD executes demand a preceding matching dryRun.
 */
@ApiTags('ops')
@UseGuards(OpsIpAllowlistGuard, OpsOperationsGuard)
@Throttle({ default: { ttl: 60_000, limit: 60 } })
@Controller('ops/operations')
export class OpsController {
  constructor(private readonly registry: OperationsRegistry) {}

  @Get()
  @ApiOperation({ summary: 'Capability manifest — every registered operation (agent-ready)' })
  list() {
    return { items: this.registry.list() };
  }

  @Get(':key')
  @ApiOperation({ summary: 'Describe one operation (schema, tier, reversibility)' })
  describe(@Param('key') key: string) {
    return this.registry.describe(key);
  }

  @Post(':key/dry-run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Preview exactly what WOULD change — never mutates' })
  async dryRun(
    @Req() req: OpsRequest,
    @Param('key') key: string,
    @Body() body: { input?: unknown },
    @Ip() ip: string,
  ) {
    return this.registry.dryRun(key, body?.input ?? {}, this.ctxOf(req, ip));
  }

  @Post(':key/execute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Execute through the registry (step-up → preconditions → tx → audit-or-rollback)' })
  async execute(
    @Req() req: OpsRequest,
    @Param('key') key: string,
    @Body() body: { input?: unknown; reason?: string },
    @Ip() ip: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.registry.execute(key, body?.input ?? {}, {
      ...this.ctxOf(req, ip),
      reason: body?.reason,
      idempotencyKey: idempotencyKey || undefined,
    });
  }

  @Post(':key/propose')
  @HttpCode(200)
  @ApiOperation({ summary: 'File a proposal (SENSITIVE/MONEY) — a human executes it from the queue' })
  async propose(
    @Req() req: OpsRequest,
    @Param('key') key: string,
    @Body() body: { input?: unknown; reason?: string },
    @Ip() ip: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.registry.propose(key, body?.input ?? {}, {
      ...this.ctxOf(req, ip),
      reason: body?.reason,
      idempotencyKey: idempotencyKey || undefined,
    });
  }

  private ctxOf(req: OpsRequest, ip: string): OperationContext {
    if (req.opsPrincipal) {
      const p = req.opsPrincipal;
      return {
        actor: { id: p.userId, type: 'HUMAN', roles: p.roles, permissions: p.permissions },
        ip,
        surface: 'ops',
        stepUpVerifiedAt: p.session.stepUpAt,
      };
    }
    const a = req.agentPrincipal!;
    return {
      // Part 4 — the agent principal: audit attributes actorType=AGENT, the
      // registry's hard rules key off it, RBAC comes from the agent's role.
      actor: { id: a.agent.id, type: 'AGENT', roles: [a.roleKey], permissions: a.permissions },
      ip,
      surface: 'ops',
      stepUpVerifiedAt: null,
      userAgent: `agent:${a.agent.nameAr}`,
    };
  }
}
