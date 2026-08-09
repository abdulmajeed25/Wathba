import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';
import { PopularFacetsScheduler } from './popular-facets.scheduler';
import { PopularFacetsService } from './popular-facets.service';

/** Batch DISC — advanced discover page (query engine + facets + bookmarks). */
@Module({
  imports: [PrismaModule],
  controllers: [DiscoverController],
  // Batch DISCOVERY-ENGINE Unit 5 — the nightly facet promoter lives here
  // rather than in its own module: it reads the same catalogue the facets do,
  // and a module whose only member is one scheduler is a folder, not a boundary.
  providers: [DiscoverService, PopularFacetsService, PopularFacetsScheduler],
  exports: [DiscoverService, PopularFacetsService],
})
export class DiscoverModule {}
