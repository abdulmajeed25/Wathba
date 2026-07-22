import { Module } from '@nestjs/common';
import { FundingModule } from '../funding/funding.module';
import { IdentityModule } from '../identity/identity.module';
import { SettingsModule } from '../settings/settings.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { LaunchScheduler } from './launch.scheduler';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TabCountsService } from './tab-counts.service';

@Module({
  imports: [FundingModule, IdentityModule, SettingsModule],
  controllers: [ProjectsController, SearchController],
  providers: [ProjectsService, SearchService, TabCountsService, LaunchScheduler],
  exports: [ProjectsService, SearchService, TabCountsService],
})
export class ProjectsModule {}
