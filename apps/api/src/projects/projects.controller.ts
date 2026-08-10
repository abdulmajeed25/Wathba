import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ProjectsService } from './projects.service';
import { FundingService } from '../funding/funding.service';
import { TabCountsService } from './tab-counts.service';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  UpdateProjectDto,
  UpdateStoryDto, ReportProjectDto } from './dto/project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tabCounts: TabCountsService,
    private readonly funding: FundingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List discoverable projects (filters + sort + cursor)' })
  async list(@Query() q: ListProjectsQueryDto) {
    const { items, nextCursor } = await this.projects.list(q);
    return { items: items.map((i) => this.projects.toPublic(i)), nextCursor };
  }

  /**
   * The signed-in creator's own campaigns — drafts included.
   *
   * MUST be declared before `@Get(':id')`, or Nest matches "mine" as an id and
   * this route is unreachable.
   */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "The signed-in creator's own projects (drafts included)" })
  async mine(@CurrentUser() jwt: JwtPayload) {
    const rows = await this.projects.listMine(jwt.sub);
    return {
      items: rows.map((p) => ({
        ...p,
        raisedHalalas: String(p.raisedHalalas),
        fundingGoalHalalas: String(p.fundingGoalHalalas),
        deadline: p.deadline ? p.deadline.toISOString() : null,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get project detail by UUID or slug (includes reward tiers)' })
  async get(@CurrentUser() jwt: JwtPayload | null, @Param('id') id: string) {
    // STAKES/N6 — accepts the human-readable slug too (/p/[slug] on the web).
    // Batch OPS — the viewer (when present) lets the creator keep seeing
    // their own moderation-hidden project; everyone else gets the 404.
    const p = await this.projects.findByIdOrSlug(id, jwt?.sub);
    return this.projects.toPublic(p);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'STAKES/K3 — report a project (deduped per reporter)' })
  async report(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportProjectDto,
  ) {
    return this.projects.report(jwt.sub, id, dto.reasonAr);
  }

  @Get(':id/similar')
  @ApiOperation({ summary: 'STAKES/J3 — LIVE projects in the same (sub)category' })
  async similar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.projects.similar(id);
  }

  @Get(':id/tab-counts')
  @ApiOperation({ summary: 'Live counts for the campaign page tabs nav (public)' })
  async tabCountsFor(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tabCounts.forProject(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a project (status=DRAFT)' })
  async create(@CurrentUser() jwt: JwtPayload, @Body() dto: CreateProjectDto) {
    const p = await this.projects.create(jwt.sub, dto);
    return this.projects.toPublic(p);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update DRAFT/UNDER_REVIEW project (owner only)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const p = await this.projects.update(jwt.sub, id, dto);
    return this.projects.toPublic(p);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a DRAFT project for admin review' })
  async submit(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const p = await this.projects.submitForReview(jwt.sub, id);
    return this.projects.toPublic(p);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Creator cancels their campaign — DRAFT deletes, UNDER_REVIEW withdraws, LIVE refunds all holds (refund policy §5)',
  })
  async cancel(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.funding.cancelCampaign(jwt.sub, id);
  }

  @Patch(':id/story')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit story/media — allowed post-launch with a public change-log (CC-11)' })
  async updateStory(
    @CurrentUser() jwt: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStoryDto,
  ) {
    const p = await this.projects.updateStory(jwt.sub, id, dto);
    return this.projects.toPublic(p);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duplicate a project into a fresh DRAFT with its tiers (owner; CC-21)' })
  async duplicate(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const p = await this.projects.duplicate(jwt.sub, id);
    return this.projects.toPublic(p);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pause a LIVE campaign — freezes new pledges, clock keeps running (owner; CC-14)' })
  async pause(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.funding.pauseCampaign(jwt.sub, id);
  }

  @Post(':id/unpause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resume a PAUSED campaign back to LIVE (owner; CC-14)' })
  async unpause(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.funding.unpauseCampaign(jwt.sub, id);
  }

  @Post(':id/deliver')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark an IN_PRODUCTION project DELIVERED (owner only; all milestones RELEASED)',
  })
  async deliver(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const p = await this.projects.completeDelivery(jwt.sub, id);
    return this.projects.toPublic(p);
  }
}
