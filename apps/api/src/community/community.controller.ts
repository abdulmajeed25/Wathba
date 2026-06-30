import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
}
