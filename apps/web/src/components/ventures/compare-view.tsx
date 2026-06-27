'use client';

import { useMemo, useState } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import { FIXTURE_VENTURES } from '@/lib/ventures/fixtures';
import type { VentureSummary } from '@/lib/ventures/types';

import { formatSar } from './format-sar';

type Dict = DictionaryShapes['ventures'];

export function VenturesCompareView({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [left, setLeft] = useState<VentureSummary>(FIXTURE_VENTURES[0]!);
  const [right, setRight] = useState<VentureSummary>(FIXTURE_VENTURES[1] ?? FIXTURE_VENTURES[0]!);

  const rows = useMemo(
    () => [
      { key: 'trustScore' as const, value: (v: VentureSummary) => String(v.trustScore) },
      { key: 'raised' as const, value: (v: VentureSummary) => formatSar(locale, v.raisedSar) },
      { key: 'target' as const, value: (v: VentureSummary) => formatSar(locale, v.targetSar) },
      { key: 'backers' as const, value: (v: VentureSummary) => String(v.backerCount) },
      { key: 'state' as const, value: (v: VentureSummary) => dict.explore.states[v.state] },
      {
        key: 'backingTypes' as const,
        value: (v: VentureSummary) =>
          v.acceptedBackingTypes.map((t) => dict.explore.backingTypes[t]).join(' · '),
      },
    ],
    [dict, locale],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold text-fg">{dict.compare.title}</h1>
        <p className="text-sm text-fg-muted">{dict.compare.subtitle}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { side: 'left' as const, venture: left, onSwap: setLeft },
          { side: 'right' as const, venture: right, onSwap: setRight },
        ].map(({ side, venture, onSwap }) => (
          <section
            key={side}
            className="flex flex-col gap-2 rounded-xl border border-edge bg-elevated p-5"
          >
            <select
              value={venture.id}
              onChange={(event) => {
                const next = FIXTURE_VENTURES.find((v) => v.id === event.target.value);
                if (next) onSwap(next);
              }}
              className="rounded-md border border-edge bg-base px-4 py-2 text-sm text-fg"
            >
              {FIXTURE_VENTURES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-fg-muted">{venture.tagline}</p>
            <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
              {rows.map((row) => (
                <Row key={row.key} label={dict.compare.rows[row.key]} value={row.value(venture)} />
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-fg-faint">{label}</dt>
      <dd className="text-fg" dir="ltr">
        {value}
      </dd>
    </>
  );
}
