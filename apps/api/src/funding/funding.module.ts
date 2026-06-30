import { Module } from '@nestjs/common';
import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';
import { FundingGateway } from './funding.gateway';
import { DeadlineScheduler } from './deadline.scheduler';
import { ContractsModule } from '../contracts/contracts.module';
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [ContractsModule, CommunityModule],
  controllers: [FundingController],
  providers: [FundingService, FundingGateway, DeadlineScheduler],
  exports: [FundingService],
})
export class FundingModule {}
