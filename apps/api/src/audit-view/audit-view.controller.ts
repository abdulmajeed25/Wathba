import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { AuditViewService } from './audit-view.service';

class AuditQueryDto extends CursorQueryDto {
  @IsOptional() @IsString() @MaxLength(64)
  action?: string;
}

/**
 * Creator self-audit timeline (Creator-CC / CC-18). Owner-gated inside the
 * service; newest-first, cursor-paginated, optional action filter.
 */
@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/audit')
export class AuditViewController {
  constructor(private readonly audit: AuditViewService) {}

  @Get()
  @ApiOperation({ summary: 'Creator self-audit trail for a project (owner only)' })
  async list(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() q: AuditQueryDto,
  ) {
    return this.audit.listForProject(jwt.sub, projectId, {
      take: q.take,
      cursor: q.cursor,
      action: q.action,
    });
  }
}
