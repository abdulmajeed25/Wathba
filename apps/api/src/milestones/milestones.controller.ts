import {
  Body, Controller, Get, Headers, Ip, Param, ParseUUIDPipe, Post, Put, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Roles, RolesGuard } from '../identity/roles.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { MilestonesService } from './milestones.service';
import { AuditService } from '../identity/audit.service';
import { OperationsRegistry } from '../ops/operations.registry';
import { OpsAuthService } from '../ops/ops-auth.service';
import {
  CreateSpendLogDto, SetMilestonesDto, SubmitEvidenceDto,
} from './dto/milestone.dto';

@ApiTags('milestones')
@Controller('projects/:projectId')
export class MilestonesController {
  constructor(
    private readonly svc: MilestonesService,
    private readonly audit: AuditService,
    private readonly registry: OperationsRegistry,
    private readonly opsAuth: OpsAuthService,
  ) {}

  @Get('milestones')
  @ApiOperation({ summary: 'List milestones for a project (public)' })
  async list(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const items = await this.svc.listForProject(projectId);
    return { items: items.map((m) => this.svc.toPublic(m)) };
  }

  @Put('milestones')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set the full milestone plan (creator only, sums to 100)' })
  async set(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: SetMilestonesDto,
  ) {
    const items = await this.svc.setMilestones(jwt.sub, projectId, dto);
    return { items: items.map((m) => this.svc.toPublic(m)) };
  }

  @Post('milestones/:milestoneId/evidence')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit evidence for a milestone (creator)' })
  async submitEvidence(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('milestoneId', new ParseUUIDPipe()) milestoneId: string,
    @Body() dto: SubmitEvidenceDto,
  ) {
    const m = await this.svc.submitEvidence(jwt.sub, projectId, milestoneId, dto);
    // CC-06 — audit the creator's evidence submission (project-scoped detail so
    // it surfaces in the creator's self-audit timeline).
    await this.audit.log({
      actorId: jwt.sub,
      action: 'creator.milestone.evidence',
      entity: 'Milestone',
      entityId: milestoneId,
      detail: { projectId, milestoneId },
    });
    return this.svc.toPublic(m);
  }

  @Post('milestones/:milestoneId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a submitted milestone — MONEY-tier operation (registry-governed)' })
  async approve(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('milestoneId', new ParseUUIDPipe()) milestoneId: string,
    @Ip() ip: string,
    @Body() dto?: { reason?: string },
    @Headers('x-idempotency-key') idemKey?: string,
    @Headers('x-ops-token') opsToken?: string,
  ) {
    await this.registry.execute(
      'money.milestone.approve',
      { projectId, milestoneId },
      await this.opsCtx(jwt, ip, dto?.reason, idemKey, opsToken),
    );
    const m = await this.svc.getOne(projectId, milestoneId);
    return this.svc.toPublic(m);
  }

  @Post('milestones/:milestoneId/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Release escrow tranche — MONEY-tier operation (registry-governed)' })
  async release(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('milestoneId', new ParseUUIDPipe()) milestoneId: string,
    @Ip() ip: string,
    @Body() dto?: { reason?: string },
    @Headers('x-idempotency-key') idemKey?: string,
    @Headers('x-ops-token') opsToken?: string,
  ) {
    const out = await this.registry.execute<{ amountHalalas: string }>(
      'money.milestone.release',
      { projectId, milestoneId },
      await this.opsCtx(jwt, ip, dto?.reason, idemKey, opsToken),
    );
    const m = await this.svc.getOne(projectId, milestoneId);
    return { milestone: this.svc.toPublic(m), amountHalalas: Number(out.result.amountHalalas) };
  }

  private async opsCtx(jwt: JwtPayload, ip: string, reason?: string, idemKey?: string, opsToken?: string) {
    return {
      actor: { id: jwt.sub, type: 'HUMAN' as const, roles: jwt.roles as unknown as string[] },
      ip,
      reason,
      // Part 1 — legacy surface: MONEY step-up proven via x-ops-token.
      surface: 'legacy' as const,
      stepUpVerifiedAt: await this.opsAuth.stepUpFromToken(opsToken),
      idempotencyKey: idemKey || `legacy-${crypto.randomUUID()}`,
    };
  }

  @Get('transparency')
  @ApiOperation({ summary: 'Live Transparency Dashboard payload' })
  async transparency(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const [budget, timeline] = await Promise.all([
      this.svc.budgetSplit(projectId),
      this.svc.listSpendLogs(projectId).then((rows) => rows.map((s) => this.svc.spendLogToPublic(s))),
    ]);
    return { budget, timeline };
  }

  @Post('spend-logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a spend log entry (creator)' })
  async addSpend(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateSpendLogDto,
  ) {
    const s = await this.svc.addSpendLog(jwt.sub, projectId, dto);
    return this.svc.spendLogToPublic(s);
  }
}
