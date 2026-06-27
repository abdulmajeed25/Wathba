import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';

/**
 * Contracts — thin pluggable layer (§6).
 * Symbolic → DONATION; physical → ISTISNA/SALAM. Neutral by default;
 * legal/Shariah configuration lands later without schema changes.
 */
@Module({
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
