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
  const cents = parseHalalas(halalas);
  if (cents === null) return 'غير متاح';
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  // Intl formats the integer BigInt exactly; only replace its two fraction
  // digits. Converting the whole amount to Number loses cents on large totals.
  const signedWhole = negative ? (whole === 0n ? -0 : -whole) : whole;
  return SAR.formatToParts(signedWhole).map(part => part.type === 'fraction' ? frac.toString().padStart(2, '0') : part.value).join('');
}

function parseHalalas(value: string | number | bigint | null | undefined): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return Number.isSafeInteger(value) ? BigInt(value) : null;
  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return null;
  try { return BigInt(value.trim()); } catch { return null; }
}

/** True when a halalas string represents a non-zero delta (for emphasis). */
export function isNonZeroHalalas(halalas: string | number | bigint | null | undefined): boolean {
  const parsed = parseHalalas(halalas);
  return parsed !== null && parsed !== 0n;
}
