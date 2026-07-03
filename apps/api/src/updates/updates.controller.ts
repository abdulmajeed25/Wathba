import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { UpdatesService } from './updates.service';
import {
  CreateUpdateDto,
  ListUpdatesQueryDto,
  UpdateUpdateDto,
} from './dto/update.dto';

@ApiTags('updates')
@Controller('projects/:projectId/updates')
export class UpdatesController {
  constructor(private readonly updates: UpdatesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List project updates (pinned-first; backer-only hidden from non-backers)' })
  async list(
    @CurrentUser() jwt: JwtPayload | null,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() q: ListUpdatesQueryDto,
  ) {
    return this.updates.list(projectId, q, jwt?.sub);
  }

  @Get(':updateId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get a single update (public permalink; respects visibility + schedule)' })
  async get(
    @CurrentUser() jwt: JwtPayload | null,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('updateId', new ParseUUIDPipe()) updateId: string,
  ) {
    return this.updates.getOne(projectId, updateId, jwt?.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a new update (creator only)' })
  async create(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateUpdateDto,
  ) {
    return this.updates.create(jwt.sub, projectId, dto);
  }

  @Patch(':updateId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit an update (creator only)' })
  async update(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('updateId', new ParseUUIDPipe()) updateId: string,
    @Body() dto: UpdateUpdateDto,
  ) {
    return this.updates.update(jwt.sub, projectId, updateId, dto);
  }

  @Post(':updateId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like an update (any logged-in user; no dedupe v1)' })
  async like(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('updateId', new ParseUUIDPipe()) updateId: string,
  ) {
    return this.updates.like(jwt.sub, projectId, updateId);
  }

  @Patch(':updateId/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle pinned on an update (creator only; CC-12)' })
  async pin(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('updateId', new ParseUUIDPipe()) updateId: string,
  ) {
    return this.updates.togglePin(jwt.sub, projectId, updateId);
  }

  @Delete(':updateId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an update (creator only)' })
  async remove(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('updateId', new ParseUUIDPipe()) updateId: string,
  ) {
    return this.updates.remove(jwt.sub, projectId, updateId);
  }
}
