import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TabCountsService } from './tab-counts.service';

@Module({
  controllers: [ProjectsController, SearchController],
  providers: [ProjectsService, SearchService, TabCountsService],
  exports: [ProjectsService, SearchService, TabCountsService],
})
export class ProjectsModule {}
