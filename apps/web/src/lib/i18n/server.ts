import { cookies } from 'next/headers';

import { LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from '@/lib/i18n/config';

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}
