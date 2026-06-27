import type { Locale } from '@/lib/i18n/config';

export function formatSar(locale: Locale, amount: number): string {
  const formatter = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    maximumFractionDigits: 0,
  });
  return locale === 'ar' ? `${formatter.format(amount)} ر.س` : `SAR ${formatter.format(amount)}`;
}
