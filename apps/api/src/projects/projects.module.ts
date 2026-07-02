import { Module } from '@nestjs/common';
import { FundingModule } from '../funding/funding.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TabCountsService } from './tab-counts.service';

@Module({
  imports: [FundingModule],
  controllers: [ProjectsController, SearchController],
  providers: [ProjectsService, SearchService, TabCountsService],
  exports: [ProjectsService, SearchService, TabCountsService],
})
export class ProjectsModule {}
