import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { TagsService } from './tags.service';

/** Batch DISCOVERY-ENGINE — public tag vocabulary reader. */
@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'The active tag vocabulary, most-used first' })
  list() {
    return this.tags.list();
  }

  /**
   * The creator typeahead. Throttled like the search suggest endpoint it
   * behaves like — one request per keystroke after debounce, not one per page.
   */
  @Get('suggest')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiQuery({ name: 'q', required: false })
  @ApiOperation({ summary: 'Tag typeahead — trigram-ranked, forgiving of partial Arabic' })
  suggest(@Query('q') q?: string) {
    return this.tags.suggest(q ?? '');
  }
}
