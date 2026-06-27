import { Global, Module } from '@nestjs/common';
import { MoyasarAdapter } from './moyasar.adapter';
import { EscrowService } from './escrow.service';
import { PayoutsController } from './payouts.controller';

@Global()
@Module({
  controllers: [PayoutsController],
  providers: [MoyasarAdapter, EscrowService],
  exports: [EscrowService, MoyasarAdapter],
})
export class EscrowPaymentsModule {}
