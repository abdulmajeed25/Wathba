import type { Route } from 'next';
import Link from 'next/link';
import { useMemo } from 'react';

import { formatDate } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/config';
import { createTranslator, type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import type { VentureSummary, VentureUpdate } from '@/lib/ventures/types';

type Dict = DictionaryShapes['ventures'];

export function UpdatePermalinkView({
  locale,
  dict,
  venture,
  update,
}: {
  locale: Locale;
  dict: Dict;
  venture: VentureSummary;
  update: VentureUpdate;
}) {
  const t = useMemo(() => createTranslator(locale, 'ventures', dict), [locale, dict]);
  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-fg-faint">{venture.name}</span>
        <h1 className="text-h1 font-semibold text-fg">{update.title}</h1>
        <p className="text-xs text-fg-faint">
          {t('updatePermalink.subtitle', { date: formatDate(locale, update.postedAt, 'medium') })}
        </p>
      </header>
      <section className="rounded-xl border border-edge bg-elevated p-5 text-sm text-fg">
        {update.body}
      </section>
      <Link
        href={`/projects/${venture.id}` as Route}
        className="self-start text-sm font-medium text-brand hover:underline"
      >
        {dict.updatePermalink.openVenture}
      </Link>
    </article>
  );
}
