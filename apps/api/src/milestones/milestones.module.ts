import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OpsModule } from '../ops/ops.module';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

@Module({
  imports: [IdentityModule, OpsModule],
  controllers: [MilestonesController],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
