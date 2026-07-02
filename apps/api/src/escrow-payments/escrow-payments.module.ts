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

@Global()
@Module({
  imports: [IdentityModule],
  controllers: [PayoutsController, WebhookController, PayoutBeneficiaryController],
  providers: [MoyasarAdapter, EscrowService, WebhookService, LedgerService, PayoutDisburser, ZatcaService, PayoutBeneficiaryService],
  exports: [EscrowService, MoyasarAdapter, LedgerService, PayoutDisburser, PayoutBeneficiaryService],
})
export class EscrowPaymentsModule {}
