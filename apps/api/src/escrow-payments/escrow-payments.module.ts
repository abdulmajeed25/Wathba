import { Global, Module } from '@nestjs/common';
import { MoyasarAdapter } from './moyasar.adapter';
import { EscrowService } from './escrow.service';
import { PayoutsController } from './payouts.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Global()
@Module({
  controllers: [PayoutsController, WebhookController],
  providers: [MoyasarAdapter, EscrowService, WebhookService],
  exports: [EscrowService, MoyasarAdapter],
})
export class EscrowPaymentsModule {}
