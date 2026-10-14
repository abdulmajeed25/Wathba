import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { CreateProjectChangeDto, ListProjectChangesDto, ProjectChangesService } from './project-changes.service';

@Controller('projects/:projectId/change-requests')
@UseGuards(JwtAuthGuard)
export class ProjectChangesController {
  constructor(private readonly changes: ProjectChangesService) {}
  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('projectId', ParseUUIDPipe) projectId: string, @Query() query: ListProjectChangesDto) {
    return this.changes.list(user.sub, projectId, query.cursor);
  }
  @Post()
  create(@CurrentUser() user: JwtPayload, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateProjectChangeDto) {
    return this.changes.create(user.sub, projectId, dto);
  }
  @Post(':requestId/withdraw')
  withdraw(@CurrentUser() user: JwtPayload, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.changes.withdraw(user.sub, projectId, requestId);
  }
}
