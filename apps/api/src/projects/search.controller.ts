import { Throttle } from '@nestjs/throttler';
import { Controller, Get, Header, Query } from '@nestjs/common';
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
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Full-text + trigram fuzzy search over projects (STAKES/L4: + filters)' })
  async query(
    @Query('q') q = '',
    @Query('limit') limit = '20',
    @Query('cat') categorySlug?: string,
    @Query('status') status?: string,
  ) {
    const parsed = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
    const items = await this.search.search(q, parsed, { categorySlug, status });
    // "هل تقصد…" is computed only when there is nothing else to show, so its
    // cost lands on the one request where the reader is stuck. An always-on
    // suggestion would add three trigram scans to every successful search.
    const suggestions = items.length === 0 ? await this.search.didYouMean(q) : null;
    return { items, suggestions };
  }

  @Get('suggest')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  // Batch SEARCH Part 2 — brief shared cache: suggestions tolerate 15s
  // staleness and the debounced keystroke stream hits this hard.
  @Header('Cache-Control', 'public, max-age=15')
  @ApiOperation({ summary: 'Typeahead: projects (thumb + creator + funded%) + creators (+count) + categories + tags' })
  async suggest(@Query('q') q = '') {
    return this.search.suggest(q);
  }
}
