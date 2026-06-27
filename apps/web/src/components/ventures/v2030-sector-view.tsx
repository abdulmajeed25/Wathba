import type { Locale } from '@/lib/i18n/config';
import { type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import { FIXTURE_SECTORS, FIXTURE_VENTURES } from '@/lib/ventures/fixtures';

import { VentureCard } from './venture-card';

type Dict = DictionaryShapes['ventures'];

export function V2030SectorView({
  locale,
  dict,
  slug,
}: {
  locale: Locale;
  dict: Dict;
  slug: string;
}) {
  const sector = FIXTURE_SECTORS.find((s) => s.slug === slug);
  const ventures = FIXTURE_VENTURES.filter((v) => v.sectors.some((s) => s.slug === slug));
  const label = sector?.name ?? slug;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold text-fg">{label}</h1>
        <p className="text-sm text-fg-muted">{dict.v2030.subtitle}</p>
      </header>

      {ventures.length === 0 ? (
        <p className="rounded-xl border border-edge bg-elevated p-9 text-center text-sm text-fg-muted">
          {dict.v2030.noVentures}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ventures.map((venture) => (
            <VentureCard key={venture.id} venture={venture} dict={dict} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
