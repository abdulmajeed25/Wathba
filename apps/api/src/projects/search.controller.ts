import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { SearchService } from './search.service';

/**
 * Public search — no auth. Backs /projects/search on the web.
 *
 * GET /v1/search?q=<arabic-or-english>&limit=20
 *
 * Returns ranked LIVE/SUCCESSFUL/FUNDED projects. Empty `q` returns [];
 * the web then falls back to its fixture for the demo screen.
 */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text + trigram fuzzy search over projects' })
  async query(
    @Query('q') q = '',
    @Query('limit') limit = '20',
  ) {
    const parsed = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
    const items = await this.search.search(q, parsed);
    return { items };
  }
}
