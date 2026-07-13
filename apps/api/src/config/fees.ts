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

/**
 * OPS-0 correction #2 — THE single source of truth for the platform
 * commission rate. ZATCA invoicing and payout withholding both derive from
 * this constant; a rate change here changes the invoice AND the money in the
 * same commit (they diverged before: fees.ts 500bp vs a hardcoded 5n in
 * zatca.service).
 */
export const PLATFORM_COMMISSION_BP = 500;
/** KSA VAT charged on the platform commission (basis points). */
export const VAT_BP = 1500;

export const METHOD_FEES: Record<'CARD' | 'TABBY' | 'TAMARA', MethodFees> = {
  CARD:   { platformBp: PLATFORM_COMMISSION_BP, processorBp: 290, processorFixedHalalas: 100, labelAr: 'بطاقة (مدى/فيزا/ماستركارد)' },
  TABBY:  { platformBp: PLATFORM_COMMISSION_BP, processorBp: 650, processorFixedHalalas: 150, labelAr: 'تابي — ٤ دفعات' },
  TAMARA: { platformBp: PLATFORM_COMMISSION_BP, processorBp: 700, processorFixedHalalas: 150, labelAr: 'تمارا — ٤ دفعات' },
};

/**
 * OPS-0 correction #2 (DECISION) — what a payout tranche withholds.
 *
 * The census P0: ZATCA invoiced a 5% commission that was never collected —
 * the disburser transferred the full released amount. Decision: the invoice
 * is settled by OFFSET at disbursement — the platform withholds exactly what
 * the invoice bills (commission + its VAT) and transfers the NET. One
 * breakdown function feeds both the invoice math and the withholding so they
 * can never disagree, down to rounding. Processor fees are NOT withheld here:
 * they are billed provider-side on the capture stream, not part of the
 * creator invoice.
 */
export function commissionBreakdown(amountHalalas: bigint): {
  commissionHalalas: bigint;
  vatHalalas: bigint;
  withheldHalalas: bigint;
  netHalalas: bigint;
} {
  const commissionHalalas = (amountHalalas * BigInt(PLATFORM_COMMISSION_BP)) / 10_000n;
  const vatHalalas = (commissionHalalas * BigInt(VAT_BP)) / 10_000n;
  const withheldHalalas = commissionHalalas + vatHalalas;
  return { commissionHalalas, vatHalalas, withheldHalalas, netHalalas: amountHalalas - withheldHalalas };
}

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
