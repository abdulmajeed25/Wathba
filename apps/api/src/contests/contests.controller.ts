import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ContestsService } from './contests.service';
import {
  AnnounceContestDto,
  CreateContestDto,
  UpdateContestDto,
} from './dto/contest.dto';
import { ContestStatus } from '@prisma/client';

@ApiTags('contests')
@Controller('projects/:projectId/contests')
export class ContestsController {
  constructor(private readonly contests: ContestsService) {}

  @Get()
  @ApiOperation({ summary: 'List "علّق واربح" rounds for a project (public)' })
  async list(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    const items = await this.contests.listForProject(projectId);
    return { items: items.map((c) => this.contests.toPublic(c)) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a contest round (DRAFT, creator-only)' })
  async create(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateContestDto,
  ) {
    const c = await this.contests.create(jwt.sub, projectId, dto);
    return this.contests.toPublic(c);
  }

  @Patch(':contestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Patch a contest round (creator-only, not after ANNOUNCED)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('contestId', new ParseUUIDPipe()) contestId: string,
    @Body() dto: UpdateContestDto,
  ) {
    const c = await this.contests.update(jwt.sub, projectId, contestId, dto);
    return this.contests.toPublic(c);
  }

  @Post(':contestId/open')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Transition DRAFT → OPEN' })
  async open(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('contestId', new ParseUUIDPipe()) contestId: string,
  ) {
    const c = await this.contests.transition(
      jwt.sub,
      projectId,
      contestId,
      ContestStatus.OPEN,
    );
    return this.contests.toPublic(c);
  }

  @Post(':contestId/close')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Transition OPEN → CLOSED' })
  async close(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('contestId', new ParseUUIDPipe()) contestId: string,
  ) {
    const c = await this.contests.transition(
      jwt.sub,
      projectId,
      contestId,
      ContestStatus.CLOSED,
    );
    return this.contests.toPublic(c);
  }

  @Post(':contestId/announce')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Announce winners (CLOSED → ANNOUNCED). Inserts a pinned creator comment + ContestWinner rows in a $transaction.',
  })
  async announce(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('contestId', new ParseUUIDPipe()) contestId: string,
    @Body() dto: AnnounceContestDto,
  ) {
    const c = await this.contests.announce(jwt.sub, projectId, contestId, dto);
    return this.contests.toPublic(c);
  }

  @Delete(':contestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a DRAFT contest (creator-only)' })
  async remove(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('contestId', new ParseUUIDPipe()) contestId: string,
  ) {
    return this.contests.remove(jwt.sub, projectId, contestId);
  }
}
