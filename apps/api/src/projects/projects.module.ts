import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [ProjectsController, SearchController],
  providers: [ProjectsService, SearchService],
  exports: [ProjectsService, SearchService],
})
export class ProjectsModule {}
