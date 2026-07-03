import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ProjectsService } from './projects.service';
import { FundingService } from '../funding/funding.service';
import { TabCountsService } from './tab-counts.service';
import { CreateProjectDto, ListProjectsQueryDto, UpdateProjectDto } from './dto/project.dto';

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

  @Get(':id')
  @ApiOperation({ summary: 'Get project detail (includes reward tiers)' })
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    const p = await this.projects.findById(id);
    return this.projects.toPublic(p);
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
