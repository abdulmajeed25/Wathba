import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PopularFacetsService } from './popular-facets.service';

/**
 * Batch DISCOVERY-ENGINE Unit 5 — the nightly pass.
 *
 * 04:00, when nobody is browsing: the recompute rewrites the homepage's second
 * chip row, and a reader mid-session never sees it change under them.
 *
 * Recompute and purge are ONE tick and in this order deliberately — the purge
 * cutoff (180d) is far outside the window (30d), so it can never delete a row
 * the recompute was about to count, and doing them together means the retention
 * bound cannot be silently forgotten if the promoter is ever disabled.
 */
@Injectable()
export class PopularFacetsScheduler {
  private readonly logger = new Logger(PopularFacetsScheduler.name);

  constructor(private readonly popular: PopularFacetsService) {}

  @Cron('0 4 * * *', { name: 'popular-facets-recompute' })
  async nightly(): Promise<void> {
    try {
      await this.popular.recompute();
    } catch (err) {
      // A failed recompute leaves the PREVIOUS window standing, which is the
      // right failure: a stale-by-a-day chip row beats an empty one.
      this.logger.error('popular facet recompute failed', err as Error);
    }
    try {
      await this.popular.purge();
    } catch (err) {
      this.logger.error('analytics retention purge failed', err as Error);
    }
  }
}
