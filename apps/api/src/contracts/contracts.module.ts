import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';

/**
 * Contracts bounded context — thin pluggable layer.
 *
 * The platform stays neutral by default — `Pledge.contractType` is a
 * field, and per-type Arabic text templates are rendered as "support
 * terms" at pledge time. Symbolic tiers default to DONATION; physical-
 * product tiers default to ISTISNA (or SALAM) and require productSpecAr
 * + expectedDeliveryDate on the project. The actual legal/Shariah
 * configuration happens later via this layer without schema changes.
 */
@Module({
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
