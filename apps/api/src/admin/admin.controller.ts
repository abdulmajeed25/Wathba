import { Body, Controller, Get, Headers, Ip, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { ProjectsService } from '../projects/projects.service';
import { AdminService } from './admin.service';
import { OperationsRegistry } from '../ops/operations.registry';
import type { OperationContext } from '../ops/operation.types';
import { OpsAuthService } from '../ops/ops-auth.service';
import { DeadlineOverrideDto, GrantRoleDto, ReviewProjectDto, SetPlatformPartnerDto, SetStaffPickDto, ModerateCommentDto, OpsReasonDto } from './dto/admin.dto';

/**
 * OPS Part 0 — this controller no longer mutates anything itself: every
 * mutation below is a thin adapter over the operations registry (which owns
 * preconditions, the transaction, the audit row and idempotency). Reads
 * (queues) stay on AdminService. Response shapes are preserved for the BFF
 * proxies and e2e seams.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly projects: ProjectsService,
    private readonly registry: OperationsRegistry,
    private readonly opsAuth: OpsAuthService,
  ) {}

  private async ctx(
    jwt: JwtPayload,
    ip: string,
    reason?: string,
    idemKey?: string,
    opsToken?: string,
  ): Promise<OperationContext> {
    return {
      actor: { id: jwt.sub, type: 'HUMAN', roles: jwt.roles as unknown as string[] },
      ip,
      reason,
      // Part 1 — these seams are the LEGACY surface: MONEY ops still require a
      // fresh step-up, proven by the caller's ops-session token (x-ops-token).
      surface: 'legacy',
      stepUpVerifiedAt: await this.opsAuth.stepUpFromToken(opsToken),
      // MONEY ops demand an idempotency key; legacy seams that don't send one
      // get single-shot semantics via a generated key.
      idempotencyKey: idemKey || `legacy-${crypto.randomUUID()}`,
    };
  }

  @Post('projects/:id/settle')
  @ApiOperation({
    summary:
      'Manual settlement trigger — MONEY-tier operation (registry: reason + idempotency + audit-in-tx)',
  })
  async settle(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Ip() ip: string,
    @Body() dto?: OpsReasonDto,
    @Headers('x-idempotency-key') idemKey?: string,
    @Headers('x-ops-token') opsToken?: string,
  ) {
    const out = await this.registry.execute(
      'money.settle.run',
      { projectId: id },
      await this.ctx(jwt, ip, dto?.reason, idemKey, opsToken),
    );
    return out.result;
  }

  @Post('payouts/disburse')
  @ApiOperation({ summary: 'Manual payout-disbursement tick — MONEY-tier operation' })
  async disburse(
    @CurrentUser() jwt: JwtPayload,
    @Ip() ip: string,
    @Body() dto?: OpsReasonDto,
    @Headers('x-idempotency-key') idemKey?: string,
    @Headers('x-ops-token') opsToken?: string,
  ) {
    const out = await this.registry.execute(
      'money.payout.disburse',
      {},
      await this.ctx(jwt, ip, dto?.reason, idemKey, opsToken),
    );
    return out.result;
  }

  @Get('review-queue')
  @ApiOperation({ summary: 'Projects awaiting review' })
  async queue() {
    const items = await this.admin.reviewQueue();
    return { items: items.map((p) => this.projects.toPublic(p)) };
  }

  @Post('projects/:id/review')
  @ApiOperation({ summary: 'Approve or reject a project under review (registry-governed)' })
  async review(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewProjectDto,
    @Ip() ip: string,
  ) {
    if (dto.decision === 'approve') {
      await this.registry.execute(
        'projects.review.approve',
        { projectId: id, ...(dto.approvedDurationDays ? { approvedDurationDays: dto.approvedDurationDays } : {}) },
        await this.ctx(jwt, ip, dto.reason),
      );
    } else {
      await this.registry.execute(
        'projects.review.reject',
        { projectId: id, ...(dto.reason?.trim() ? { feedbackAr: dto.reason.trim() } : {}) },
        await this.ctx(jwt, ip, dto.reason),
      );
    }
    const updated = await this.projects.findRaw(id);
    return this.projects.toPublic(updated);
  }

  @Post('projects/:id/deadline-override')
  @ApiOperation({ summary: 'Force a project deadline — MONEY-tier operation (settlement drills + e2e seam)' })
  async deadlineOverride(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DeadlineOverrideDto,
    @Ip() ip: string,
    @Headers('x-idempotency-key') idemKey?: string,
    @Headers('x-ops-token') opsToken?: string,
  ) {
    const out = await this.registry.execute(
      'money.deadline.override',
      { projectId: id, deadline: dto.deadline },
      await this.ctx(jwt, ip, dto.reason, idemKey, opsToken),
    );
    return out.result;
  }

  @Put('projects/:id/platform-partner')
  @ApiOperation({ summary: '§7 — set/clear Wathba-venture marker (mandatory disclosureAr)' })
  async setPartner(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPlatformPartnerDto,
    @Ip() ip: string,
  ) {
    await this.registry.execute(
      'projects.platform-partner.set',
      { projectId: id, value: dto.platformPartner },
      await this.ctx(jwt, ip),
    );
    const updated = await this.projects.findRaw(id);
    return this.projects.toPublic(updated);
  }

  @Put('projects/:id/staff-pick')
  @ApiOperation({ summary: 'Toggle "مختارات وثبة" editorial pick (registry-governed)' })
  async setStaffPick(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetStaffPickDto,
    @Ip() ip: string,
  ) {
    await this.registry.execute(
      'projects.staff-pick.set',
      { projectId: id, value: dto.isStaffPick },
      await this.ctx(jwt, ip),
    );
    const updated = await this.projects.findRaw(id);
    return this.projects.toPublic(updated);
  }

  @Get('kyc-queue')
  @ApiOperation({ summary: 'Users awaiting KYC verification' })
  async kyc() {
    return { items: await this.admin.kycQueue() };
  }

  @Post('users/:id/grant-role')
  @ApiOperation({ summary: 'Grant a role — SENSITIVE-tier operation (written reason required)' })
  async grantRole(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: GrantRoleDto,
    @Ip() ip: string,
  ) {
    const out = await this.registry.execute(
      'users.role.grant',
      { userId: id, role: dto.role },
      await this.ctx(jwt, ip, dto.reason),
    );
    return out.result;
  }

  @Post('users/:id/force-verify')
  @ApiOperation({ summary: 'Mark a user Nafath-verified — SENSITIVE-tier operation (reason required)' })
  async forceVerify(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Ip() ip: string,
    @Body() dto?: OpsReasonDto,
  ) {
    const out = await this.registry.execute(
      'users.kyc.force-verify',
      { userId: id },
      await this.ctx(jwt, ip, dto?.reason),
    );
    return out.result;
  }

  // ── STAKES/K2 K3 — moderation queue ──────────────────────────────────────

  @Get('moderation')
  @ApiOperation({ summary: 'STAKES/K2 K3 — reported comments + reported projects' })
  async moderation() {
    return this.admin.moderationQueue();
  }

  @Post('comments/:id/moderate')
  @ApiOperation({ summary: 'Hide a reported comment or dismiss its flags (registry-governed)' })
  async moderateComment(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ModerateCommentDto,
    @Ip() ip: string,
  ) {
    const out = await this.registry.execute(
      'moderation.comment.moderate',
      { commentId: id, action: dto.action },
      await this.ctx(jwt, ip, dto.reason),
    );
    return out.result;
  }

  @Post('projects/:id/reports/dismiss')
  @ApiOperation({ summary: 'Dismiss all open reports on a project (registry-governed)' })
  async dismissProjectReports(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Ip() ip: string,
    @Body() dto?: OpsReasonDto,
  ) {
    const out = await this.registry.execute(
      'moderation.project-reports.dismiss',
      { projectId: id },
      await this.ctx(jwt, ip, dto?.reason),
    );
    return out.result;
  }
}
