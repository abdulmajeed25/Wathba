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
  @ApiOperation({ summary: 'List project updates (orderNum desc)' })
  async list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() q: ListUpdatesQueryDto,
  ) {
    return this.updates.list(projectId, q);
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
