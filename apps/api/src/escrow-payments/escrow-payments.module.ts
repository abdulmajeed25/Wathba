import { Global, Module } from '@nestjs/common';
import { MoyasarAdapter } from './moyasar.adapter';
import { EscrowService } from './escrow.service';
import { PayoutsController } from './payouts.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { LedgerService } from './ledger.service';
import { PayoutDisburser } from './payout.disburser';
import { ZatcaService } from './zatca.service';

@Global()
@Module({
  controllers: [PayoutsController, WebhookController],
  providers: [MoyasarAdapter, EscrowService, WebhookService, LedgerService, PayoutDisburser, ZatcaService],
  exports: [EscrowService, MoyasarAdapter, LedgerService, PayoutDisburser],
})
export class EscrowPaymentsModule {}
