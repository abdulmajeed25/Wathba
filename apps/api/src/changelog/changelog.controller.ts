import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { ChangelogService } from './changelog.service';

/** Public change-log (Creator-CC / CC-11) — transparency for backers. */
@ApiTags('changelog')
@Controller('projects/:projectId/changelog')
export class ChangelogController {
  constructor(private readonly changelog: ChangelogService) {}

  @Get()
  @ApiOperation({ summary: 'Public content change-log for a project (newest first)' })
  async list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() q: CursorQueryDto,
  ) {
    return this.changelog.list(projectId, { take: q.take, cursor: q.cursor });
  }
}
