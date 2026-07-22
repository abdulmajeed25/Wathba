import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { OpsIpAllowlistGuard, OpsSessionGuard } from '../ops-session.guard';
import type { OpsPrincipal } from '../ops-auth.service';
import { OpsReadService } from './ops-read.service';

type OpsRequest = Request & { opsPrincipal: OpsPrincipal };

function toBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  return v === '1' || v === 'true';
}
function toNum(v: string | undefined): number | undefined {
  return v === undefined ? undefined : Number(v);
}
function toDate(v: string | undefined): Date | undefined {
  return v === undefined ? undefined : new Date(v);
}

/**
 * Batch OPS-PRO Phase 2 — the OPS READ surface (/v1/ops/…). READ-ONLY list +
 * detail endpoints the operator screens consume. Guarded exactly like the
 * audit browser (IP allowlist + live ops session), throttled, and each route
 * asserts its own permission through OpsReadService.assertPermission — the
 * refusal is the standard Arabic 403. PII is masked by the service; money is
 * emitted as halalas strings.
 */
@ApiTags('ops')
@UseGuards(OpsIpAllowlistGuard, OpsSessionGuard)
@Throttle({ default: { ttl: 60_000, limit: 120 } })
@Controller('ops')
export class OpsReadController {
  constructor(private readonly read: OpsReadService) {}

  /* ── 1. dashboard ──────────────────────────────────────────────────────── */

  @Get('dashboard')
  @ApiOperation({ summary: 'Command-center board — work-queue counts + platform vitals' })
  dashboard(@Req() req: OpsRequest) {
    this.read.assertPermission(req.opsPrincipal, 'analytics.read');
    return this.read.dashboard();
  }

  /* ── 2. projects ───────────────────────────────────────────────────────── */

  @Get('projects')
  @ApiOperation({ summary: 'Projects list — filter status/category/q/hidden, cursor-paged' })
  projects(
    @Req() req: OpsRequest,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
    @Query('hidden') hidden?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listProjects({
      status,
      categoryId,
      q,
      hidden: toBool(hidden),
      cursor,
      limit: toNum(limit),
    });
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Project detail — milestones, payout summary, recent (masked) pledges' })
  project(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.projectDetail(id);
  }

  /* ── 3. users ──────────────────────────────────────────────────────────── */

  @Get('users')
  @ApiOperation({ summary: 'Masked user directory — filter role/status/q, cursor-paged' })
  users(
    @Req() req: OpsRequest,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'users.lifecycle');
    return this.read.listUsers({
      role,
      status: status as 'active' | 'suspended' | 'banned' | undefined,
      q,
      cursor,
      limit: toNum(limit),
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Masked user profile — roles, counts, suspension state (no raw PII)' })
  user(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'users.lifecycle');
    return this.read.userDetail(id);
  }

  /* ── 4/5. money ────────────────────────────────────────────────────────── */

  @Get('money/pledges')
  @ApiOperation({ summary: 'Pledges browser — filter project/status/backer, cursor-paged' })
  pledges(
    @Req() req: OpsRequest,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('backerId') backerId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listPledges({ projectId, status, backerId, cursor, limit: toNum(limit) });
  }

  @Get('money/payouts')
  @ApiOperation({ summary: 'Payouts browser — filter status, cursor-paged' })
  payouts(
    @Req() req: OpsRequest,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listPayouts({ status, cursor, limit: toNum(limit) });
  }

  @Get('money/ledger')
  @ApiOperation({ summary: 'Ledger browser — filter entryType/project/pledge/date, cursor-paged' })
  ledger(
    @Req() req: OpsRequest,
    @Query('entryType') entryType?: string,
    @Query('projectId') projectId?: string,
    @Query('pledgeId') pledgeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listLedger({
      entryType,
      projectId,
      pledgeId,
      from: toDate(from),
      to: toDate(to),
      cursor,
      limit: toNum(limit),
    });
  }

  @Get('money/reconciliation')
  @ApiOperation({ summary: 'Reconciliation run history — most recent first, verdict summary' })
  reconciliation(
    @Req() req: OpsRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listReconciliation({ cursor, limit: toNum(limit) });
  }

  /* ── 6. tickets ────────────────────────────────────────────────────────── */

  @Get('tickets')
  @ApiOperation({ summary: 'Support inbox — filter status/assignee/q, cursor-paged (masked email)' })
  tickets(
    @Req() req: OpsRequest,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'support.tickets');
    return this.read.listTickets({ status, assignedToId, q, cursor, limit: toNum(limit) });
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Ticket detail — message + internal notes (masked email)' })
  ticket(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'support.tickets');
    return this.read.ticketDetail(id);
  }

  /* ── 7. procurement ────────────────────────────────────────────────────── */

  @Get('procurement/rfqs')
  @ApiOperation({ summary: 'RFQ list — bid counts + status, cursor-paged' })
  rfqs(
    @Req() req: OpsRequest,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listRfqs({ status, projectId, cursor, limit: toNum(limit) });
  }

  @Get('procurement/rfqs/:id')
  @ApiOperation({ summary: 'RFQ detail — bids with masked supplier' })
  rfq(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.rfqDetail(id);
  }

  /* ── 8. settings ───────────────────────────────────────────────────────── */

  @Get('settings')
  @ApiOperation({ summary: 'Effective platform settings — each key with value + source (db|default)' })
  settings(@Req() req: OpsRequest) {
    // Read allowed for either the writer (settings.write) or an analyst.
    const p = req.opsPrincipal;
    if (
      !p.permissions.includes('*') &&
      !p.permissions.includes('settings.write') &&
      !p.permissions.includes('analytics.read')
    ) {
      this.read.assertPermission(p, 'settings.write');
    }
    return this.read.effectiveSettings();
  }
}
