/**
 * Arabic-locale number formatting. The design uses Arabic-Indic digits in
 * Arabic copy ("١٢" "٢١٤") and Western digits next to the SAR symbol — we
 * follow that convention here.
 */
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toArabicDigits(value: string | number): string {
  const s = String(value);
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) out += ARABIC_DIGITS[code - 48];
    else out += ch;
  }
  return out;
}

export function fmtSAR(halalas: number, opts: { useArabicDigits?: boolean } = {}): string {
  const sar = halalas / 100;
  const formatted = sar.toLocaleString('en-US', {
    maximumFractionDigits: sar % 1 === 0 ? 0 : 2,
  });
  const out = `${formatted} ر.س`;
  return opts.useArabicDigits ? toArabicDigits(out) : out;
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export function fmtPct(raised: number, goal: number): number {
  if (goal === 0) return 0;
  return Math.round((raised / goal) * 100);
}
