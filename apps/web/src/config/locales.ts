import type { Locale } from '@/lib/i18n/config';

/**
 * Per-locale presentation config (REDESIGN-PLAN §6.4).
 * A third locale = one entry here + a dictionary directory + a font stack entry.
 */
export interface LocalePreset {
  /** BCP-47 tag handed to every Intl API. */
  intlLocale: string;
  /** Hijri secondary calendar tag, when ceremonial dates render one (§1.10). */
  hijriLocale?: string;
  /**
   * Numbering system default. Western digits in both locales per §1.10;
   * Arabic-Indic is a user preference (settings/accessibility), not a locale default.
   */
  numberingSystem: 'latn' | 'arab';
  nativeName: string;
}

export const localePresets: Record<Locale, LocalePreset> = {
  ar: {
    intlLocale: 'ar-SA',
    hijriLocale: 'ar-SA-u-ca-islamic-umalqura',
    numberingSystem: 'latn',
    nativeName: 'العربية',
  },
  en: {
    intlLocale: 'en',
    numberingSystem: 'latn',
    nativeName: 'English',
  },
};
