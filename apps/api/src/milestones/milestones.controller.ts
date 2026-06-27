import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { MilestonesService } from './milestones.service';
import {
  CreateSpendLogDto, SetMilestonesDto, SubmitEvidenceDto,
} from './dto/milestone.dto';

@ApiTags('milestones')
@Controller('projects/:projectId')
export class MilestonesController {
  constructor(private readonly svc: MilestonesService) {}

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
    return this.svc.toPublic(m);
  }

  @Post('milestones/:milestoneId/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a submitted milestone (admin)' })
  async approve(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('milestoneId', new ParseUUIDPipe()) milestoneId: string,
  ) {
    const m = await this.svc.approve(projectId, milestoneId);
    return this.svc.toPublic(m);
  }

  @Post('milestones/:milestoneId/release')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Release escrow tranche for an approved milestone (admin)' })
  async release(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('milestoneId', new ParseUUIDPipe()) milestoneId: string,
  ) {
    const { milestone, amountHalalas } = await this.svc.release(projectId, milestoneId);
    return { milestone: this.svc.toPublic(milestone), amountHalalas: Number(amountHalalas) };
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
