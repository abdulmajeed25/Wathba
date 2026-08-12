/**
 * OPS Part 5 — money formatting. The API serialises halalas as BigInt→string
 * (never a JS number — amounts exceed 2^53). Everything on this surface is
 * displayed as SAR (halalas / 100) in the ar-SA locale. One helper so no
 * screen re-implements the division and risks a rounding drift.
 */
// Batch ACCOUNT / U3 — `-u-nu-latn`, not bare 'ar-SA'. A bare Arabic locale
// picks Arabic-Indic digits, which is why the vault rendered GMV as
// ١٬٣٩٤٬٨٨٠٫٠٠ while the rest of the platform showed Latin. Operators reconcile
// these figures against bank and PSP statements, which are Latin — a numeral
// system nobody can paste into a spreadsheet is a reconciliation hazard, not a
// style choice.
const SAR = new Intl.NumberFormat('ar-SA-u-nu-latn', {
  style: 'currency',
  currency: 'SAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format halalas (string|number|bigint) as an ar-SA SAR string. */
export function formatSar(halalas: string | number | bigint | null | undefined): string {
  if (halalas === null || halalas === undefined || halalas === '') return SAR.format(0);
  let cents: bigint;
  try {
    cents = typeof halalas === 'bigint' ? halalas : BigInt(String(halalas).replace(/[^\d-]/g, '') || '0');
  } catch {
    return SAR.format(0);
  }
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  // Reconstruct as a Number only for the fractional formatting (safe: bounded).
  const asNumber = Number(whole) + Number(frac) / 100;
  return SAR.format(negative ? -asNumber : asNumber);
}

/** True when a halalas string represents a non-zero delta (for emphasis). */
export function isNonZeroHalalas(halalas: string | number | bigint | null | undefined): boolean {
  if (halalas === null || halalas === undefined || halalas === '') return false;
  try {
    return BigInt(String(halalas).replace(/[^\d-]/g, '') || '0') !== 0n;
  } catch {
    return false;
  }
}
