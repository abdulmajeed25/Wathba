import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';

/** STAKES/S-15 (H4) — the contact form's delivery path. */
@Module({ controllers: [SupportController] })
export class SupportModule {}
