import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { OpsProposalsService } from './ops-proposals.service';
import { OpsIpAllowlistGuard, OpsSessionGuard } from './ops-session.guard';
import type { OpsPrincipal } from './ops-auth.service';
import type { OperationContext } from './operation.types';

type OpsRequest = Request & { opsPrincipal: OpsPrincipal };

/**
 * OPS Part 2 — the four-eyes approval queue:
 *   GET  /v1/ops/proposals?status=PENDING     the queue
 *   GET  /v1/ops/proposals/:id                one proposal (with its preview)
 *   POST /v1/ops/proposals/:id/approve        execute — DIFFERENT user, money.approve, step-up
 *   POST /v1/ops/proposals/:id/reject         money.approve + written reason
 *   POST /v1/ops/proposals/:id/cancel         proposer withdraws their own
 */
@ApiTags('ops')
@UseGuards(OpsIpAllowlistGuard, OpsSessionGuard)
@Throttle({ default: { ttl: 60_000, limit: 60 } })
@Controller('ops/proposals')
export class OpsProposalsController {
  constructor(private readonly proposals: OpsProposalsService) {}

  @Get()
  @ApiOperation({ summary: 'List proposals (default: all recent; filter by status)' })
  list(@Query('status') status?: string) {
    return this.proposals.list(status).then((items) => ({ items }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'One proposal with its dryRun snapshot' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.proposals.get(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Second pair of eyes: execute the proposal (self-approval refused)' })
  approve(
    @Req() req: OpsRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { reason?: string },
    @Ip() ip: string,
  ) {
    return this.proposals.approve(id, { ...this.ctxOf(req.opsPrincipal, ip), reason: body?.reason });
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refuse the proposal (money.approve + written reason)' })
  reject(
    @Req() req: OpsRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { reason?: string },
    @Ip() ip: string,
  ) {
    return this.proposals.reject(id, this.ctxOf(req.opsPrincipal, ip), body?.reason ?? '');
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Proposer withdraws their own pending proposal' })
  cancel(
    @Req() req: OpsRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { reason?: string },
    @Ip() ip: string,
  ) {
    return this.proposals.cancel(id, this.ctxOf(req.opsPrincipal, ip), body?.reason ?? '');
  }

  private ctxOf(p: OpsPrincipal, ip: string): OperationContext {
    return {
      actor: { id: p.userId, type: 'HUMAN', roles: p.roles, permissions: p.permissions },
      ip,
      surface: 'ops',
      stepUpVerifiedAt: p.session.stepUpAt,
    };
  }
}
