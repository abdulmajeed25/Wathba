import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { OpsAuditService } from './ops-audit.service';
import { OpsRbacService } from './ops-rbac.service';
import { OpsIpAllowlistGuard, OpsSessionGuard } from './ops-session.guard';
import type { OpsPrincipal } from './ops-auth.service';

type OpsRequest = Request & { opsPrincipal: OpsPrincipal };

/**
 * OPS Part 3 — the audit surface (permission: audit.read):
 *   GET /v1/ops/audit                     filterable browser feed
 *   GET /v1/ops/audit/verify              recompute the hash chain
 *   GET /v1/ops/audit/entity/:type/:id    the per-entity history panel
 */
@ApiTags('ops')
@UseGuards(OpsIpAllowlistGuard, OpsSessionGuard)
@Throttle({ default: { ttl: 60_000, limit: 120 } })
@Controller('ops/audit')
export class OpsAuditController {
  constructor(
    private readonly audit: OpsAuditService,
    private readonly rbac: OpsRbacService,
  ) {}

  private assertRead(p: OpsPrincipal): void {
    const actor = { id: p.userId, type: 'HUMAN' as const, roles: p.roles, permissions: p.permissions };
    if (!this.rbac.has(actor, 'audit.read')) {
      throw new ForbiddenException('تفتقد الصلاحية المطلوبة: audit.read');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Audit browser — filter by actor/action/entity/tier/date, cursor-paged' })
  list(
    @Req() req: OpsRequest,
    @Query('actorId') actorId?: string,
    @Query('actorType') actorType?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('riskTier') riskTier?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.assertRead(req.opsPrincipal);
    return this.audit.list({
      actorId,
      actorType,
      action,
      entity,
      entityId,
      riskTier,
      q,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      cursor: cursor ? BigInt(cursor) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('verify')
  @ApiOperation({ summary: 'Recompute the hash chain — any break names its first seq' })
  verify(@Req() req: OpsRequest) {
    this.assertRead(req.opsPrincipal);
    return this.audit.verify();
  }

  @Get('entity/:type/:id')
  @ApiOperation({ summary: 'Everything that ever touched one entity (the history panel)' })
  entityTrail(
    @Req() req: OpsRequest,
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    this.assertRead(req.opsPrincipal);
    return this.audit.entityTrail(type, id, limit ? Number(limit) : undefined);
  }
}
