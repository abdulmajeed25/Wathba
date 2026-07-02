import { Global, Module } from '@nestjs/common';
import { MoyasarAdapter } from './moyasar.adapter';
import { EscrowService } from './escrow.service';
import { PayoutsController } from './payouts.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { LedgerService } from './ledger.service';

@Global()
@Module({
  controllers: [PayoutsController, WebhookController],
  providers: [MoyasarAdapter, EscrowService, WebhookService, LedgerService],
  exports: [EscrowService, MoyasarAdapter, LedgerService],
})
export class EscrowPaymentsModule {}
