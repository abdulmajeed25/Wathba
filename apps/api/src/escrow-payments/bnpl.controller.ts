import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { BnplService, type BnplProvider } from './bnpl.service';

/** Batch PAY (Part 4) — Tabby/Tamara webhooks (sandbox). */
@ApiTags('webhooks')
@Controller('webhooks')
export class BnplWebhookController {
  constructor(private readonly bnpl: BnplService) {}

  @Post('tabby')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({ summary: 'Tabby webhook — HMAC-verified, idempotent, replay-safe' })
  async tabby(
    @Req() req: Request,
    @Headers('x-tabby-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.handle('TABBY', req, signature, body);
  }

  @Post('tamara')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({ summary: 'Tamara webhook — HMAC-verified, idempotent, replay-safe' })
  async tamara(
    @Req() req: Request,
    @Headers('x-tamara-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.handle('TAMARA', req, signature, body);
  }

  private async handle(
    provider: BnplProvider,
    req: Request,
    signature: string | undefined,
    body: Record<string, unknown>,
  ) {
    const raw =
      (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? JSON.stringify(body);
    const outcome = await this.bnpl.handleWebhook(provider, raw, signature, {
      pledgeId: typeof body.pledgeId === 'string' ? body.pledgeId : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
      eventId: typeof body.eventId === 'string' ? body.eventId : undefined,
    });
    return outcome;
  }
}
