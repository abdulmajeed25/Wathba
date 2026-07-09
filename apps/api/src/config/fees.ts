/**
 * Batch PAY (Part 4) — fee basis PER PAYMENT METHOD.
 *
 * BNPL provider fees are materially higher than card fees; the creator's
 * payout math and the public fee-transparency page are fee-aware per method.
 * Values are basis points (1% = 100 bp) + a fixed per-transaction component
 * in halalas — integers only, no floats, BigInt math at the call sites.
 * Sandbox placeholder rates; production rates land with provider contracts
 * (owner task).
 */
export interface MethodFees {
  /** Wathba platform commission (basis points). */
  platformBp: number;
  /** Processor/provider fee (basis points). */
  processorBp: number;
  /** Fixed processor component per transaction (halalas). */
  processorFixedHalalas: number;
  labelAr: string;
}

export const METHOD_FEES: Record<'CARD' | 'TABBY' | 'TAMARA', MethodFees> = {
  CARD:   { platformBp: 500, processorBp: 290, processorFixedHalalas: 100, labelAr: 'بطاقة (مدى/فيزا/ماستركارد)' },
  TABBY:  { platformBp: 500, processorBp: 650, processorFixedHalalas: 150, labelAr: 'تابي — ٤ دفعات' },
  TAMARA: { platformBp: 500, processorBp: 700, processorFixedHalalas: 150, labelAr: 'تمارا — ٤ دفعات' },
};

/** Effective fee for an amount, all-BigInt. */
export function feeFor(method: keyof typeof METHOD_FEES, amountHalalas: bigint): {
  platformHalalas: bigint;
  processorHalalas: bigint;
  netHalalas: bigint;
} {
  const f = METHOD_FEES[method];
  const platformHalalas = (amountHalalas * BigInt(f.platformBp)) / 10_000n;
  const processorHalalas =
    (amountHalalas * BigInt(f.processorBp)) / 10_000n + BigInt(f.processorFixedHalalas);
  return { platformHalalas, processorHalalas, netHalalas: amountHalalas - platformHalalas - processorHalalas };
}
