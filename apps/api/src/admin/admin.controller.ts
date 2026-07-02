import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { ProjectsService } from '../projects/projects.service';
import { FundingService } from '../funding/funding.service';
import { PayoutDisburser } from '../escrow-payments/payout.disburser';
import { AdminService } from './admin.service';
import { AuditService } from '../identity/audit.service';
import { GrantRoleDto, ReviewProjectDto, SetPlatformPartnerDto } from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly projects: ProjectsService,
    private readonly funding: FundingService,
    private readonly disburser: PayoutDisburser,
    private readonly audit: AuditService,
  ) {}

  @Post('projects/:id/settle')
  @ApiOperation({
    summary:
      'Manual settlement trigger (Sprint 1 / P0-304) — settles a past-deadline LIVE project, ' +
      'or sweeps HELD residue on an already-settled one',
  })
  async settle(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.audit.log({ actorId: jwt.sub, action: 'admin.settle', entity: 'Project', entityId: id });
    const result = await this.funding.settleProject(id);
    if (result.transition !== 'noop') return result;
    // Already settled (or not due) — attempt a residue sweep for stuck HELD pledges.
    try {
      return await this.funding.resettleResidue(id);
    } catch {
      return result; // genuinely nothing to do (e.g. still LIVE before deadline)
    }
  }

  @Post('payouts/disburse')
  @ApiOperation({ summary: 'Manual payout-disbursement tick (Sprint 1 / P0-301)' })
  async disburse(@CurrentUser() jwt: JwtPayload) {
    await this.audit.log({ actorId: jwt.sub, action: 'admin.disburse', entity: 'Payout' });
    return this.disburser.disbursePending();
  }

  @Get('review-queue')
  @ApiOperation({ summary: 'Projects awaiting review' })
  async queue() {
    const items = await this.admin.reviewQueue();
    return { items: items.map((p) => this.projects.toPublic(p)) };
  }

  @Post('projects/:id/review')
  @ApiOperation({ summary: 'Approve or reject a project under review' })
  async review(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewProjectDto,
  ) {
    await this.audit.log({
      actorId: jwt.sub,
      action: `admin.review.${dto.decision}`,
      entity: 'Project',
      entityId: id,
      detail: dto.reason ? { reason: dto.reason } : undefined,
    });
    const updated = dto.decision === 'approve'
      ? await this.admin.approve(id)
      : await this.admin.reject(id, dto.reason);
    return this.projects.toPublic(updated);
  }

  @Put('projects/:id/platform-partner')
  @ApiOperation({ summary: '§7 — set/clear Wathba-venture marker (mandatory disclosureAr)' })
  async setPartner(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetPlatformPartnerDto,
  ) {
    await this.audit.log({ actorId: jwt.sub, action: 'admin.platform-partner', entity: 'Project', entityId: id });
    const updated = await this.admin.setPlatformPartner(id, dto.platformPartner);
    return this.projects.toPublic(updated);
  }

  @Get('kyc-queue')
  @ApiOperation({ summary: 'Users awaiting KYC verification' })
  async kyc() {
    return { items: await this.admin.kycQueue() };
  }

  @Post('users/:id/grant-role')
  @ApiOperation({ summary: 'Grant a role (e.g. SUPPLIER) to a user — audited (Sprint 3 / P0-302)' })
  async grantRole(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: GrantRoleDto,
  ) {
    await this.audit.log({
      actorId: jwt.sub,
      action: `admin.grant-role.${dto.role}`,
      entity: 'User',
      entityId: id,
    });
    return this.admin.grantRole(id, dto.role);
  }

  @Post('users/:id/force-verify')
  @ApiOperation({ summary: 'Admin override — mark a user Nafath-verified' })
  async forceVerify(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.audit.log({ actorId: jwt.sub, action: 'admin.kyc.force-verify', entity: 'User', entityId: id });
    return this.admin.forceVerifyKyc(id);
  }
}
