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

  /* ── 1b. OPS-360 alerts center + name resolution ───────────────────────── */

  @Get('alerts')
  @ApiOperation({ summary: 'Global anomaly center — live alerts, sorted critical→warn→info' })
  alerts(@Req() req: OpsRequest) {
    this.read.assertPermission(req.opsPrincipal, 'analytics.read');
    return this.read.alerts();
  }

  @Get('resolve/actors')
  @ApiOperation({ summary: 'Batch name resolution — ?ids=uuid,uuid → {id:{name,kind}} (no PII)' })
  resolveActors(@Req() req: OpsRequest, @Query('ids') ids?: string) {
    // Either an auditor (audit.read) or an analyst (analytics.read) may resolve
    // the actor/assignee names their screens render.
    const p = req.opsPrincipal;
    if (
      !p.permissions.includes('*') &&
      !p.permissions.includes('audit.read') &&
      !p.permissions.includes('analytics.read')
    ) {
      this.read.assertPermission(p, 'audit.read');
    }
    const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.read.resolveActors(list);
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

  // Static route BEFORE the parametric `projects/:id` so it isn't shadowed.
  @Get('projects/stats')
  @ApiOperation({ summary: 'Project count-by-status (cross-page) — filter category' })
  projectStats(@Req() req: OpsRequest, @Query('categoryId') categoryId?: string) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.projectStats({ categoryId });
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Project detail — milestones, payout summary, recent (masked) pledges' })
  project(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.projectDetail(id);
  }

  /* ── 2b. project sub-resources (projects.review) ───────────────────────── */

  @Get('projects/:id/updates')
  @ApiOperation({ summary: 'Project updates — snippeted body, cursor-paged' })
  projectUpdates(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listProjectUpdates(id, { cursor, limit: toNum(limit) });
  }

  @Get('projects/:id/comments')
  @ApiOperation({ summary: 'Project comments — masked author, snippet, cursor-paged' })
  projectComments(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('hidden') hidden?: string,
    @Query('reported') reported?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listComments({
      projectId: id,
      hidden: toBool(hidden),
      reported: toBool(reported),
      cursor,
      limit: toNum(limit),
    });
  }

  @Get('projects/:id/reward-tiers')
  @ApiOperation({ summary: 'Project reward tiers — money as strings, cursor-paged' })
  projectRewardTiers(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listRewardTiers(id, { cursor, limit: toNum(limit) });
  }

  @Get('projects/:id/addons')
  @ApiOperation({ summary: 'Project add-ons — money as strings, cursor-paged' })
  projectAddOns(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listAddOns(id, { cursor, limit: toNum(limit) });
  }

  @Get('projects/:id/spend-logs')
  @ApiOperation({ summary: 'Project spend logs — transparency ledger, cursor-paged' })
  projectSpendLogs(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listSpendLogs(id, { cursor, limit: toNum(limit) });
  }

  @Get('projects/:id/collaborators')
  @ApiOperation({ summary: 'Project collaborators — content-access grants, cursor-paged' })
  projectCollaborators(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listCollaborators(id, { cursor, limit: toNum(limit) });
  }

  @Get('projects/:id/faq-questions')
  @ApiOperation({ summary: 'Project FAQ questions — masked asker, snippet, cursor-paged' })
  projectFaqQuestions(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listFaqQuestions(id, { cursor, limit: toNum(limit) });
  }

  @Get('projects/:id/contests')
  @ApiOperation({ summary: 'Project contests — FSM state + prize refs, cursor-paged' })
  projectContests(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listContests(id, { cursor, limit: toNum(limit) });
  }

  @Get('projects/:id/backers')
  @ApiOperation({ summary: 'Full backer roster — masked backer, rewardStatus, cursor-paged' })
  projectBackers(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listProjectBackers(id, { cursor, limit: toNum(limit) });
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

  // Static routes BEFORE the parametric `users/:id` so they aren't shadowed.
  @Get('users/stats')
  @ApiOperation({ summary: 'User count-by-status (active/suspended/banned) + verification' })
  userStats(@Req() req: OpsRequest) {
    this.read.assertPermission(req.opsPrincipal, 'users.lifecycle');
    return this.read.userStats();
  }

  @Get('users/kyc-queue')
  @ApiOperation({ summary: 'KYC/Nafath queue — unverified users; supplierUnverified filter' })
  kycQueue(
    @Req() req: OpsRequest,
    @Query('supplierUnverified') supplierUnverified?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'users.lifecycle');
    return this.read.listKycQueue({
      supplierUnverified: toBool(supplierUnverified),
      cursor,
      limit: toNum(limit),
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Masked user profile — roles, ops-roles, counts, suspension (no raw PII)' })
  user(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'users.lifecycle');
    return this.read.userDetail(id);
  }

  @Get('users/:id/pledges')
  @ApiOperation({ summary: 'A user\'s pledges — masked backer, string money, cursor-paged' })
  userPledges(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'users.lifecycle');
    return this.read.listUserPledges(id, { cursor, limit: toNum(limit) });
  }

  @Get('users/:id/sessions')
  @ApiOperation({ summary: 'A user\'s sessions — RefreshToken + KnownDevice, hashes withheld' })
  userSessions(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'users.lifecycle');
    return this.read.listUserSessions(id, { cursor, limit: toNum(limit) });
  }

  @Get('users/:id/notifications')
  @ApiOperation({ summary: 'A user\'s notifications — allowlisted payload summary, filter by kind' })
  userNotifications(
    @Req() req: OpsRequest,
    @Param('id') id: string,
    @Query('kind') kind?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'users.lifecycle');
    return this.read.listUserNotifications(id, { kind, cursor, limit: toNum(limit) });
  }

  /* ── 3c. notifications delivery-mix (analytics.read) ────────────────────── */

  @Get('notifications/stats')
  @ApiOperation({ summary: 'Notification delivery mix — count-by-kind over a recent window' })
  notificationStats(@Req() req: OpsRequest, @Query('windowDays') windowDays?: string) {
    this.read.assertPermission(req.opsPrincipal, 'analytics.read');
    return this.read.notificationStats(toNum(windowDays));
  }

  /* ── 3b. moderation queue (moderation.queue) ───────────────────────────── */

  @Get('moderation/reports')
  @ApiOperation({ summary: 'Unified moderation queue — open project + comment reports merged' })
  moderationReports(
    @Req() req: OpsRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'moderation.queue');
    return this.read.listModerationReports({ cursor, limit: toNum(limit) });
  }

  @Get('moderation/comments')
  @ApiOperation({ summary: 'Comments browser — filter projectId/hidden/reported, masked author' })
  moderationComments(
    @Req() req: OpsRequest,
    @Query('projectId') projectId?: string,
    @Query('hidden') hidden?: string,
    @Query('reported') reported?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'moderation.queue');
    return this.read.listComments({
      projectId,
      hidden: toBool(hidden),
      reported: toBool(reported),
      cursor,
      limit: toNum(limit),
    });
  }

  /* ── 3d. OPS-GAPS R1 — appeals queue (moderation.queue) ────────────────── */

  @Get('appeals')
  @ApiOperation({ summary: 'Appeals queue — filter status/kind, open-first + oldest-first, masked submitter' })
  appeals(
    @Req() req: OpsRequest,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'moderation.queue');
    return this.read.listAppeals({ status, kind, cursor, limit: toNum(limit) });
  }

  @Get('appeals/:id')
  @ApiOperation({ summary: 'Appeal detail — original decision context + originalDeciderId (self-review guard)' })
  appeal(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'moderation.queue');
    return this.read.appealDetail(id, req.opsPrincipal.userId);
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

  /* ── 5b. money observability (money.execute) ───────────────────────────── */

  @Get('money/beneficiaries')
  @ApiOperation({ summary: 'Payout beneficiaries — masked IBAN/mobile, verified filter' })
  beneficiaries(
    @Req() req: OpsRequest,
    @Query('verified') verified?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listBeneficiaries({ verified: toBool(verified), cursor, limit: toNum(limit) });
  }

  @Get('money/beneficiaries/:userId')
  @ApiOperation({ summary: 'Payout beneficiary detail — masked IBAN/mobile for one creator' })
  beneficiary(@Req() req: OpsRequest, @Param('userId') userId: string) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.beneficiaryDetail(userId);
  }

  @Get('money/zatca-invoices')
  @ApiOperation({ summary: 'ZATCA invoice browser — includes reportedAt-null orphans' })
  zatcaInvoices(
    @Req() req: OpsRequest,
    @Query('reported') reported?: string,
    @Query('creatorId') creatorId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listZatcaInvoices({
      reported: toBool(reported),
      creatorId,
      cursor,
      limit: toNum(limit),
    });
  }

  @Get('money/webhook-events')
  @ApiOperation({ summary: 'Webhook event browser — outcome filter (unblocks webhooks.replay)' })
  webhookEvents(
    @Req() req: OpsRequest,
    @Query('outcome') outcome?: string,
    @Query('provider') provider?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listWebhookEvents({ outcome, provider, cursor, limit: toNum(limit) });
  }

  @Get('money/disputes')
  @ApiOperation({ summary: 'Dispute queue — pledges in DISPUTED, masked backer' })
  disputes(
    @Req() req: OpsRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listDisputes({ cursor, limit: toNum(limit) });
  }

  @Get('money/milestones')
  @ApiOperation({ summary: 'Cross-project milestones queue — defaults status=SUBMITTED' })
  milestoneQueue(
    @Req() req: OpsRequest,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'money.execute');
    return this.read.listMilestoneQueue({ status, projectId, cursor, limit: toNum(limit) });
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

  // Static route BEFORE the parametric `tickets/:id` so it isn't shadowed.
  @Get('tickets/stats')
  @ApiOperation({ summary: 'Support ticket count-by-status (cross-page)' })
  ticketStats(@Req() req: OpsRequest) {
    this.read.assertPermission(req.opsPrincipal, 'support.tickets');
    return this.read.ticketStats();
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
    // OPS-360 A6 — procurement reads split off projects.review so a pure
    // REVIEWER no longer browses all supplier bids. procurement.read = OWNER/OPS_MANAGER.
    this.read.assertPermission(req.opsPrincipal, 'procurement.read');
    return this.read.listRfqs({ status, projectId, cursor, limit: toNum(limit) });
  }

  @Get('procurement/rfqs/:id')
  @ApiOperation({ summary: 'RFQ detail — bids with masked supplier' })
  rfq(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'procurement.read');
    return this.read.rfqDetail(id);
  }

  /* ── 7b. supplier entity profile (projects.review) ─────────────────────── */

  @Get('suppliers/:userId')
  @ApiOperation({ summary: 'Supplier profile — masked user + bids + verification + won/lost' })
  supplier(@Req() req: OpsRequest, @Param('userId') userId: string) {
    // OPS-360 A6 — follows the RFQ reads onto procurement.read.
    this.read.assertPermission(req.opsPrincipal, 'procurement.read');
    return this.read.supplierProfile(userId);
  }

  /* ── 7c. OPS-360 U4 — contests oversight (projects.review) ─────────────── */

  // Contests have NO governed ops yet (creation/announce are creator-driven);
  // this is OVERSIGHT-ONLY read. Award/management ops are a Unit-6 follow-up.
  @Get('contests')
  @ApiOperation({ summary: 'Cross-project contest list — FSM status filter, winner tally' })
  contests(
    @Req() req: OpsRequest,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listAllContests({ status, cursor, limit: toNum(limit) });
  }

  @Get('contests/:id')
  @ApiOperation({ summary: 'Contest detail — winners roster with masked backer, announced state' })
  contest(@Req() req: OpsRequest, @Param('id') id: string) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.contestDetail(id);
  }

  /* ── 7d. OPS-360 U4 — fulfillment view (projects.review) ───────────────── */

  @Get('fulfillment')
  @ApiOperation({ summary: 'Cross-project reward-fulfillment roster — rewardStatus filter, masked backer' })
  fulfillment(
    @Req() req: OpsRequest,
    @Query('rewardStatus') rewardStatus?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.read.assertPermission(req.opsPrincipal, 'projects.review');
    return this.read.listFulfillment({ rewardStatus, cursor, limit: toNum(limit) });
  }

  /* ── 7e. content taxonomy (content.categories) ─────────────────────────── */

  @Get('categories')
  @ApiOperation({ summary: 'All categories incl. inactive/hidden — flat list w/ parentId, for reactivation' })
  categories(@Req() req: OpsRequest) {
    // OPS-GAPS Y1 — the ops taxonomy read: unlike the public GET /v1/categories
    // (active-only), this surfaces hidden nodes so an operator can reactivate
    // them. READ-ONLY.
    this.read.assertPermission(req.opsPrincipal, 'content.categories');
    return this.read.listAllCategories();
  }

  /* ── 7f. editorial + collections (CLOSEOUT C3 — off the /v1/admin seam) ─── */

  @Get('editorial/cards')
  @ApiOperation({ summary: 'All editorial cards incl. inactive — ops-token gated (was /v1/admin)' })
  editorialCards(@Req() req: OpsRequest) {
    this.read.assertPermission(req.opsPrincipal, 'content.editorial');
    return this.read.listAllEditorialCards();
  }

  @Get('editorial/sections')
  @ApiOperation({ summary: 'All homepage sections incl. disabled — ops-token gated (was /v1/admin)' })
  editorialSections(@Req() req: OpsRequest) {
    this.read.assertPermission(req.opsPrincipal, 'content.editorial');
    return this.read.listAllHomepageSections();
  }

  @Get('collections')
  @ApiOperation({ summary: 'All collections incl. inactive w/ project counts — ops-token gated' })
  collections(@Req() req: OpsRequest) {
    this.read.assertPermission(req.opsPrincipal, 'content.collections');
    return this.read.listAllCollections();
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

  /* ── 9. comms — email-template catalog (settings.write OR analytics.read) ── */

  @Get('comms/templates')
  @ApiOperation({ summary: 'Email-template catalog — effective subject/body preview + hasOverride' })
  commsTemplates(@Req() req: OpsRequest) {
    this.assertCommsRead(req.opsPrincipal);
    return this.read.listCommsTemplates();
  }

  @Get('comms/templates/:key')
  @ApiOperation({ summary: 'Email-template detail — code default + current override (for the editor)' })
  commsTemplate(@Req() req: OpsRequest, @Param('key') key: string) {
    this.assertCommsRead(req.opsPrincipal);
    return this.read.commsTemplateDetail(key);
  }

  /** Read allowed for either the template editor (settings.write) or an
   *  analyst (analytics.read) — mirrors the settings read gate. */
  private assertCommsRead(p: OpsPrincipal): void {
    if (
      !p.permissions.includes('*') &&
      !p.permissions.includes('settings.write') &&
      !p.permissions.includes('analytics.read')
    ) {
      this.read.assertPermission(p, 'settings.write');
    }
  }
}
