import { Global, Module } from '@nestjs/common';
import { MoyasarAdapter } from './moyasar.adapter';
import { EscrowService } from './escrow.service';

@Global()
@Module({
  providers: [MoyasarAdapter, EscrowService],
  exports: [EscrowService, MoyasarAdapter],
})
export class EscrowPaymentsModule {}
