import { Global, Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { MoyasarAdapter } from './moyasar.adapter';
import { EscrowService } from './escrow.service';
import { PayoutsController } from './payouts.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { LedgerService } from './ledger.service';
import { PayoutDisburser } from './payout.disburser';
import { ZatcaService } from './zatca.service';
import { PayoutBeneficiaryService } from './payout-beneficiary.service';
import { PayoutBeneficiaryController } from './payout-beneficiary.controller';
import { BnplService } from './bnpl.service';
import { BnplWebhookController } from './bnpl.controller';

@Global()
@Module({
  imports: [IdentityModule],
  controllers: [PayoutsController, WebhookController, BnplWebhookController, PayoutBeneficiaryController],
  providers: [MoyasarAdapter, EscrowService, BnplService, WebhookService, LedgerService, PayoutDisburser, ZatcaService, PayoutBeneficiaryService],
  exports: [EscrowService, MoyasarAdapter, BnplService, LedgerService, PayoutDisburser, PayoutBeneficiaryService, ZatcaService, WebhookService],
})
export class EscrowPaymentsModule {}
