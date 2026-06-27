import type { Route } from 'next';
import Link from 'next/link';
import { useMemo } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { createTranslator, type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import { FIXTURE_SECTORS, FIXTURE_VENTURES } from '@/lib/ventures/fixtures';

type Dict = DictionaryShapes['ventures'];

export function V2030View({ locale, dict }: { locale: Locale; dict: Dict }) {
  const t = useMemo(() => createTranslator(locale, 'ventures', dict), [locale, dict]);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold text-fg">{dict.v2030.title}</h1>
        <p className="text-sm text-fg-muted">{dict.v2030.subtitle}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIXTURE_SECTORS.map((sector) => {
          const count = FIXTURE_VENTURES.filter((v) =>
            v.sectors.some((s) => s.slug === sector.slug),
          ).length;
          return (
            <Link
              key={sector.slug}
              href={`/projects/v2030/${sector.slug}` as Route}
              className="flex flex-col gap-1 rounded-xl border border-edge bg-elevated p-5 transition-colors hover:border-edge-strong"
            >
              <span className="text-body font-medium text-fg">{sector.name}</span>
              <span className="text-xs text-fg-faint" dir="ltr">
                {t('v2030.ventureCount', { count })}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
