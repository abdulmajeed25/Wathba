import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { CollaboratorsService } from './collaborators.service';

/** A minimal editorial surface; never exposes full campaign or financial data. */
@ApiTags('collaborators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('content-workspaces')
export class ContentWorkspacesController {
  constructor(private readonly collaborators: CollaboratorsService) {}

  @Get()
  list(@CurrentUser() jwt: JwtPayload) {
    return this.collaborators.workspaces(jwt.sub);
  }

  @Get(':projectId')
  get(@CurrentUser() jwt: JwtPayload, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.collaborators.workspace(jwt.sub, projectId);
  }
}
