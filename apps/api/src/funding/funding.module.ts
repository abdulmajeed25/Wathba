import { Module } from '@nestjs/common';

/**
 * Funding bounded context — pledges + funding FSM + deadline job.
 * Implementation lands in Phase 1.
 *
 * FSM: DRAFT → UNDER_REVIEW → LIVE → {SUCCESSFUL|FAILED}
 *      SUCCESSFUL → FUNDED → IN_PRODUCTION → DELIVERED
 *      FAILED → REFUNDED
 * Rule: at deadline, capture iff raised >= goal * releaseThresholdPct/100.
 */
@Module({})
export class FundingModule {}
