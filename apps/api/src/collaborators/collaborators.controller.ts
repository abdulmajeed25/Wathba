import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { CollaboratorsService } from './collaborators.service';

class InviteCollaboratorDto {
  @IsEmail()
  email!: string;
}

/**
 * Per-project collaborators (Creator-CC / CC-24). Owner-managed; a collaborator
 * gets content access (updates). Money/lifecycle stay owner-only.
 */
@ApiTags('collaborators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/collaborators')
export class CollaboratorsController {
  constructor(private readonly collaborators: CollaboratorsService) {}

  @Get()
  @ApiOperation({ summary: 'List project collaborators (owner only)' })
  async list(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.collaborators.list(jwt.sub, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Invite a collaborator by email (owner only)' })
  async invite(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: InviteCollaboratorDto,
  ) {
    return this.collaborators.invite(jwt.sub, projectId, dto.email);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a collaborator (owner only)' })
  async remove(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.collaborators.remove(jwt.sub, projectId, userId);
  }
}
