import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

/** Batch DISC — advanced discover page (query engine + facets + bookmarks). */
@Module({
  imports: [PrismaModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
  exports: [DiscoverService],
})
export class DiscoverModule {}
