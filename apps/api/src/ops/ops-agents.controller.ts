import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { OpsAgentsService } from './ops-agents.service';
import { OpsRbacService } from './ops-rbac.service';
import { OpsIpAllowlistGuard, OpsSessionGuard } from './ops-session.guard';
import type { OpsPrincipal } from './ops-auth.service';

type OpsRequest = Request & { opsPrincipal: OpsPrincipal };

/**
 * OPS Part 4 — the «الوكلاء» read surface (HUMAN-only; management itself is
 * the agents.* operations):
 *   GET /v1/ops/agents   accounts + kill-switch state (permission agents.manage)
 */
@ApiTags('ops')
@UseGuards(OpsIpAllowlistGuard, OpsSessionGuard)
@Throttle({ default: { ttl: 60_000, limit: 60 } })
@Controller('ops/agents')
export class OpsAgentsController {
  constructor(
    private readonly agents: OpsAgentsService,
    private readonly rbac: OpsRbacService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Agent accounts + the AGENTS_ENABLED kill-switch state' })
  async list(@Req() req: OpsRequest) {
    const p = req.opsPrincipal;
    const actor = { id: p.userId, type: 'HUMAN' as const, roles: p.roles, permissions: p.permissions };
    if (!this.rbac.has(actor, 'agents.manage')) {
      throw new ForbiddenException('تفتقد الصلاحية المطلوبة: agents.manage');
    }
    return { agentsEnabled: this.agents.enabled, items: await this.agents.list() };
  }
}
