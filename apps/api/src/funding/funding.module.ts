import { Module } from '@nestjs/common';
import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';
import { FundingGateway } from './funding.gateway';
import { DeadlineScheduler } from './deadline.scheduler';
import { GraceScheduler } from './grace.scheduler';
import { ReauthScheduler } from './reauth.scheduler';
import { ContractsModule } from '../contracts/contracts.module';
import { CommunityModule } from '../community/community.module';
import { IdentityModule } from '../identity/identity.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ContractsModule, CommunityModule, IdentityModule, SettingsModule],
  controllers: [FundingController],
  providers: [FundingService, FundingGateway, DeadlineScheduler, GraceScheduler, ReauthScheduler],
  exports: [FundingService],
})
export class FundingModule {}
