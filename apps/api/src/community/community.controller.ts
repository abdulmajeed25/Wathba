import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { CommunityService } from './community.service';

@ApiTags('community')
@Controller('projects/:projectId/community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get()
  @ApiOperation({
    summary: 'Public backer-community aggregates (top cities, countries, totals)',
  })
  async snapshot(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.community.snapshot(projectId);
  }

  @Post('rebuild')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Recompute community aggregates from pledges (owner only) — CC-08' })
  async rebuild(
    @CurrentUser() jwt: JwtPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.community.rebuild(jwt.sub, projectId);
  }
}
