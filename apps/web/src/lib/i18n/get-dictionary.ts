import { IntlMessageFormat } from 'intl-messageformat';

import { localePresets } from '@/config/locales';
import type { Locale } from '@/lib/i18n/config';

import type ventures from '@/dictionaries/en/ventures.json';

/**
 * Slimmed dictionary surface for the Wathba (وثبة) web app.
 * Only the `ventures` namespace ships here; the broader multi-namespace shim
 * from the source surface was trimmed when this app was brought into the
 * standalone Wathba monorepo. Add a namespace here when a new dictionary is
 * introduced.
 */
export interface DictionaryShapes {
  ventures: typeof ventures;
}

export type Namespace = keyof DictionaryShapes;

type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
}[keyof T & string];

export type DictKey<N extends Namespace> = DotPaths<DictionaryShapes[N]>;

const loaders: {
  [N in Namespace]: Record<Locale, () => Promise<{ default: DictionaryShapes[N] }>>;
} = {
  ventures: {
    ar: () => import('@/dictionaries/ar/ventures.json'),
    en: () => import('@/dictionaries/en/ventures.json'),
  },
};

export async function getDictionary<N extends Namespace>(
  locale: Locale,
  namespace: N,
): Promise<DictionaryShapes[N]> {
  const mod = await loaders[namespace][locale]();
  return mod.default;
}

export type TranslateValues = Record<string, string | number | boolean | Date>;

export type Translator<N extends Namespace> = (key: DictKey<N>, values?: TranslateValues) => string;

const formatCache = new Map<string, IntlMessageFormat>();

export function createTranslator<N extends Namespace>(
  locale: Locale,
  namespace: N,
  dict: DictionaryShapes[N],
): Translator<N> {
  const preset = localePresets[locale];
  const messageLocale = `${preset.intlLocale}-u-nu-${preset.numberingSystem}`;
  return (key, values) => {
    const message = key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        dict,
      );
    if (typeof message !== 'string') return key;
    if (!values) return message;

    const cacheKey = `${locale}:${namespace}:${key}`;
    let format = formatCache.get(cacheKey);
    if (!format) {
      format = new IntlMessageFormat(message, messageLocale);
      formatCache.set(cacheKey, format);
    }
    const out = format.format(values);
    return Array.isArray(out) ? out.join('') : String(out);
  };
}

export async function getTranslator<N extends Namespace>(
  locale: Locale,
  namespace: N,
): Promise<Translator<N>> {
  return createTranslator(locale, namespace, await getDictionary(locale, namespace));
}
