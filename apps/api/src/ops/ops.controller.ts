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
import { OpsIpAllowlistGuard, OpsSessionGuard } from './ops-session.guard';
import type { OpsPrincipal } from './ops-auth.service';

type OpsRequest = Request & { opsPrincipal: OpsPrincipal };

/**
 * OPS Part 0/1 — the registry's HTTP surface:
 *   GET  /v1/ops/operations            machine-readable capability manifest
 *   GET  /v1/ops/operations/:key       describe one operation
 *   POST /v1/ops/operations/:key/dry-run
 *   POST /v1/ops/operations/:key/execute
 *
 * Part 1 hardening: the surface now requires the SEPARATE ops session
 * (OpsSessionGuard — the public bearer JWT is not accepted), sits behind
 * the optional IP allowlist, and carries the session's step-up state into
 * the registry, which enforces the 10-minute window on MONEY/SENSITIVE.
 * Part 2 swaps the coarse ADMIN gate for per-permission RBAC inside the
 * registry.
 */
@ApiTags('ops')
@UseGuards(OpsIpAllowlistGuard, OpsSessionGuard)
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
    return this.registry.dryRun(key, body?.input ?? {}, this.ctxOf(req.opsPrincipal, ip));
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
      ...this.ctxOf(req.opsPrincipal, ip),
      reason: body?.reason,
      idempotencyKey: idempotencyKey || undefined,
    });
  }

  private ctxOf(p: OpsPrincipal, ip: string): OperationContext {
    return {
      // Part 2 — the resolved RBAC permissions ride on the actor; the
      // registry's PermissionPort checks nothing else on this surface.
      actor: { id: p.userId, type: 'HUMAN', roles: p.roles, permissions: p.permissions },
      ip,
      surface: 'ops',
      stepUpVerifiedAt: p.session.stepUpAt,
    };
  }
}
