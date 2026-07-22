import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import type { OpsPrincipal } from '../ops-auth.service';
import { OpsIpAllowlistGuard, OpsSessionGuard } from '../ops-session.guard';
import { ImpersonationService } from './impersonation.service';

type OpsRequest = Request & { opsPrincipal: OpsPrincipal };

/**
 * OPS-360 Unit-2 — the READ-ONLY view-as impersonation surface
 * (/v1/ops/impersonation/…). OWNER-only (the service asserts the '*'
 * wildcard); guarded exactly like the read layer (IP allowlist + live ops
 * session) and throttled tighter than the read surface — impersonation is a
 * rare, high-sensitivity act. NO route here can perform a write or op against
 * a business entity: start/stop write ONLY an AuditLog row, view returns a
 * masked read-only snapshot.
 */
@ApiTags('ops')
@UseGuards(OpsIpAllowlistGuard, OpsSessionGuard)
@Throttle({ default: { ttl: 60_000, limit: 30 } })
@Controller('ops/impersonation')
export class OpsImpersonationController {
  constructor(private readonly svc: ImpersonationService) {}

  @Post('start')
  @ApiOperation({ summary: 'Begin a read-only view-as session (OWNER-only, audited) — mints a 15-min handle' })
  start(@Req() req: OpsRequest, @Body() body: { userId?: string; reason?: string }) {
    return this.svc.start(req.opsPrincipal, body?.userId ?? '', body?.reason ?? '', req.ip);
  }

  @Post('stop')
  @ApiOperation({ summary: 'End a view-as session (OWNER-only, audited) — revokes the handle' })
  stop(@Req() req: OpsRequest, @Body() body: { handle?: string; reason?: string }) {
    return this.svc.stop(req.opsPrincipal, body?.handle ?? '', body?.reason, req.ip);
  }

  @Get('view/:userId')
  @ApiOperation({ summary: 'Read-only snapshot for an active view-as session — requires x-impersonation-token' })
  view(
    @Req() req: OpsRequest,
    @Param('userId') userId: string,
    @Headers('x-impersonation-token') handle?: string,
  ) {
    return this.svc.view(req.opsPrincipal, userId, handle, req.ip);
  }
}
