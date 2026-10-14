import { Module } from '@nestjs/common';
import { FundingModule } from '../funding/funding.module';
import { IdentityModule } from '../identity/identity.module';
import { SettingsModule } from '../settings/settings.module';
import { TagsModule } from '../tags/tags.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { LaunchScheduler } from './launch.scheduler';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TabCountsService } from './tab-counts.service';
import { ProjectChangesService } from './project-changes.service';
import { ProjectChangesController } from './project-changes.controller';
import { ChangeConsentController } from './change-consent.controller';
import { ChangeConsentService } from './change-consent.service';

@Module({
  imports: [FundingModule, IdentityModule, SettingsModule, TagsModule],
  controllers: [ProjectsController, SearchController, ProjectChangesController, ChangeConsentController],
  providers: [ProjectsService, SearchService, TabCountsService, LaunchScheduler, ProjectChangesService, ChangeConsentService],
  exports: [ProjectsService, SearchService, TabCountsService],
})
export class ProjectsModule {}
