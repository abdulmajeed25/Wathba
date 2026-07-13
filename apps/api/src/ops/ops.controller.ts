import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { OperationsRegistry } from './operations.registry';
import type { OperationContext } from './operation.types';

/**
 * OPS Part 0 — the registry's HTTP surface:
 *   GET  /v1/ops/operations            machine-readable capability manifest
 *   GET  /v1/ops/operations/:key       describe one operation
 *   POST /v1/ops/operations/:key/dry-run
 *   POST /v1/ops/operations/:key/execute
 *
 * ADMIN-only + tighter throttle than public routes. The manifest doubles as
 * the Part-4 agent tool manifest. Part 1 adds the separate ops session +
 * step-up on top of this surface; Part 2 swaps the coarse ADMIN gate for
 * per-permission RBAC inside the registry.
 */
@ApiTags('ops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
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
    @CurrentUser() jwt: JwtPayload,
    @Param('key') key: string,
    @Body() body: { input?: unknown },
    @Ip() ip: string,
  ) {
    return this.registry.dryRun(key, body?.input ?? {}, this.ctxOf(jwt, ip));
  }

  @Post(':key/execute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Execute through the registry (preconditions → tx → audit-or-rollback)' })
  async execute(
    @CurrentUser() jwt: JwtPayload,
    @Param('key') key: string,
    @Body() body: { input?: unknown; reason?: string },
    @Ip() ip: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.registry.execute(key, body?.input ?? {}, {
      ...this.ctxOf(jwt, ip),
      reason: body?.reason,
      idempotencyKey: idempotencyKey || undefined,
    });
  }

  private ctxOf(jwt: JwtPayload, ip: string): OperationContext {
    return {
      actor: { id: jwt.sub, type: 'HUMAN', roles: jwt.roles as unknown as string[] },
      ip,
    };
  }
}
