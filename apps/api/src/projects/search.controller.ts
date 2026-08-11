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

  /**
   * Per-IP 30/min. Tighter than the global 120/min because each miss costs a
   * GIN scan plus, on zero results, three trigram scans.
   *
   * ENV-TUNABLE FOR THE SAME REASON AS SIGN-IN. The whole Playwright suite
   * searches from ONE IP, so this limit is shared across every spec in the
   * run rather than being per-spec. arabic-search.spec.ts alone makes about
   * twenty calls; anything that ran before it has already spent part of the
   * budget, so the spec passed in isolation and failed in the suite —
   * ORDER-DEPENDENTLY, since how much budget was left depended on what ran
   * first. A 429 answers `{statusCode:429}` with no `items` key, so the
   * failure surfaced as `Cannot read properties of undefined (reading
   * 'length')` rather than as anything resembling rate limiting.
   *
   * Production leaves SEARCH_THROTTLE_LIMIT unset and keeps 30.
   */
  @Get()
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.SEARCH_THROTTLE_LIMIT ?? 30) } })
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

  // Same reasoning as above, and the suite drives this one through the real
  // typeahead (AS12 types into the header box), so a debounced keystroke
  // stream lands here on top of whatever the API-level specs spent.
  @Get('suggest')
  @Throttle({ default: { ttl: 60_000, limit: Number(process.env.SUGGEST_THROTTLE_LIMIT ?? 120) } })
  // Batch SEARCH Part 2 — brief shared cache: suggestions tolerate 15s
  // staleness and the debounced keystroke stream hits this hard.
  @Header('Cache-Control', 'public, max-age=15')
  @ApiOperation({ summary: 'Typeahead: projects (thumb + creator + funded%) + creators (+count) + categories + tags' })
  async suggest(@Query('q') q = '') {
    return this.search.suggest(q);
  }
}
