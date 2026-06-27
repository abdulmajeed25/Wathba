import { Module } from '@nestjs/common';
import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';
import { DeadlineScheduler } from './deadline.scheduler';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [ContractsModule],
  controllers: [FundingController],
  providers: [FundingService, DeadlineScheduler],
  exports: [FundingService],
})
export class FundingModule {}
