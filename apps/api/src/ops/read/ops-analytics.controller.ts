import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { OpsIpAllowlistGuard, OpsSessionGuard } from '../ops-session.guard';
import type { OpsPrincipal } from '../ops-auth.service';
import { OpsAnalyticsService } from './ops-analytics.service';

type OpsRequest = Request & { opsPrincipal: OpsPrincipal };

function toDate(v: string | undefined): Date | undefined {
  if (v === undefined) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * OPS-360 Phase B · Unit 5 — the ANALYTICS AGGREGATE surface (/v1/ops/analytics/…).
 * READ-ONLY aggregate endpoints (groupBy/count/aggregate) the analytics screens
 * consume. Guarded exactly like the ops read browser (IP allowlist + live ops
 * session) and throttled. Dashboards are gated `analytics.read`; the financial
 * report — which surfaces commission/VAT/GMV/liability — is gated the stronger
 * `money.execute`. Every route accepts ?from&to; the service echoes the window
 * it used and emits money as halalas strings.
 */
@ApiTags('ops')
@UseGuards(OpsIpAllowlistGuard, OpsSessionGuard)
@Throttle({ default: { ttl: 60_000, limit: 120 } })
@Controller('ops/analytics')
export class OpsAnalyticsController {
  constructor(private readonly analytics: OpsAnalyticsService) {}

  @Get('financial')
  @ApiOperation({ summary: 'Financial report — GMV, commission, VAT, pledged, refunds, payouts, net liability' })
  financial(
    @Req() req: OpsRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Stronger gate: the financial report exposes commission/VAT/GMV/liability.
    this.analytics.assertPermission(req.opsPrincipal, 'money.execute');
    return this.analytics.financial({ from: toDate(from), to: toDate(to) });
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Conversion funnel — signup→verify→pledge→repeat, drop-offs (top-of-funnel honest-null)' })
  funnel(
    @Req() req: OpsRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.analytics.assertPermission(req.opsPrincipal, 'analytics.read');
    return this.analytics.funnel({ from: toDate(from), to: toDate(to) });
  }

  /**
   * Batch DISCOVERY-ENGINE Unit 5 — what readers filtered by, and what the
   * nightly pass did with it.
   *
   * `analytics.read`, like the other dashboards. AGGREGATE ONLY: the response
   * is (key, value, count) rows plus the current promoted list — there is no
   * per-user view here, and the service has no query that could produce one.
   */
  @Get('discovery')
  @ApiOperation({ summary: 'Discovery analytics — most-applied filters in the window + the promoted row' })
  discovery(
    @Req() req: OpsRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.analytics.assertPermission(req.opsPrincipal, 'analytics.read');
    return this.analytics.discovery({ from: toDate(from), to: toDate(to) });
  }

  @Get('projects')
  @ApiOperation({ summary: 'Project analytics — success rate, status distribution, per-category, pledged-vs-realized' })
  projects(
    @Req() req: OpsRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.analytics.assertPermission(req.opsPrincipal, 'analytics.read');
    return this.analytics.projects({ from: toDate(from), to: toDate(to) });
  }

  @Get('users')
  @ApiOperation({ summary: 'User analytics — KYC conversion, distinct backers, tiers, sessions, suspended/banned' })
  users(
    @Req() req: OpsRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.analytics.assertPermission(req.opsPrincipal, 'analytics.read');
    return this.analytics.users({ from: toDate(from), to: toDate(to) });
  }

  @Get('operations')
  @ApiOperation({ summary: 'Operational metrics — capture-failure/refund/dispute rates, moderation, tickets, payouts' })
  operations(
    @Req() req: OpsRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.analytics.assertPermission(req.opsPrincipal, 'analytics.read');
    return this.analytics.operations({ from: toDate(from), to: toDate(to) });
  }
}
