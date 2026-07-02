import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WebhookService, type MoyasarWebhookPayload } from './webhook.service';

/**
 * PSP webhook receiver (Sprint 1 / P0-003). Public by design — Moyasar
 * authenticates via the shared secret_token in the body, verified in
 * constant time before any processing.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post('moyasar')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 240 } })
  @ApiOperation({ summary: 'Moyasar payment events (paid/failed/refunded/voided) — idempotent' })
  async moyasar(@Body() payload: MoyasarWebhookPayload): Promise<{ outcome: string }> {
    this.webhooks.verify(payload);
    return this.webhooks.process(payload);
  }
}
