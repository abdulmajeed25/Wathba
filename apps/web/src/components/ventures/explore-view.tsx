'use client';

import { useMemo, useState } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import { FIXTURE_SECTORS, FIXTURE_VENTURES } from '@/lib/ventures/fixtures';
import type { BackingType, VentureState } from '@/lib/ventures/types';

import { VentureCard } from './venture-card';

type Dict = DictionaryShapes['ventures'];

type StateFilter = VentureState | 'all';
type BackingFilter = BackingType | 'all';

export function VenturesExploreView({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [sector, setSector] = useState<string>('all');
  const [state, setState] = useState<StateFilter>('all');
  const [backing, setBacking] = useState<BackingFilter>('all');
  const [impactMin, setImpactMin] = useState(0);

  const filtered = useMemo(() => {
    return FIXTURE_VENTURES.filter((v) => {
      if (sector !== 'all' && !v.sectors.some((s) => s.slug === sector)) return false;
      if (state !== 'all' && v.state !== state) return false;
      if (backing !== 'all' && !v.acceptedBackingTypes.includes(backing)) return false;
      if (v.impactPct < impactMin) return false;
      return true;
    });
  }, [sector, state, backing, impactMin]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold text-fg">{dict.explore.title}</h1>
        <p className="text-sm text-fg-muted">{dict.explore.subtitle}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <FilterGroup label={dict.explore.filters.sector}>
          <Chip
            active={sector === 'all'}
            onClick={() => setSector('all')}
            label={dict.explore.filters.sector}
          />
          {FIXTURE_SECTORS.map((s) => (
            <Chip
              key={s.slug}
              active={sector === s.slug}
              onClick={() => setSector(s.slug)}
              label={s.name}
            />
          ))}
        </FilterGroup>
        <FilterGroup label={dict.explore.filters.state}>
          {(['all', 'raising', 'active', 'milestoneHold', 'closed'] as const).map((value) => (
            <Chip
              key={value}
              active={state === value}
              onClick={() => setState(value)}
              label={dict.explore.states[value]}
            />
          ))}
        </FilterGroup>
        <FilterGroup label={dict.explore.filters.backingType}>
          {(['all', 'reward', 'equity', 'royalty', 'strategicSponsor'] as const).map((value) => (
            <Chip
              key={value}
              active={backing === value}
              onClick={() => setBacking(value)}
              label={dict.explore.backingTypes[value]}
            />
          ))}
        </FilterGroup>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-fg-faint">{dict.explore.filters.impactMin}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={impactMin}
            onChange={(event) => setImpactMin(Number(event.target.value))}
            className="w-40"
            aria-label={dict.explore.filters.impactMin}
          />
          <span className="text-xs text-fg-muted" dir="ltr">
            {impactMin}%
          </span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-edge bg-elevated p-9 text-center text-sm text-fg-muted">
          {dict.explore.noResults}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((venture) => (
            <VentureCard key={venture.id} venture={venture} dict={dict} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-fg-faint">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? 'border-brand bg-brand/10 text-fg'
          : 'border-edge text-fg-muted hover:border-edge-strong'
      }`}
    >
      {label}
    </button>
  );
}
