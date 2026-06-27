import type { Route } from 'next';
import Link from 'next/link';
import { useMemo } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { createTranslator, type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import type { VentureSummary } from '@/lib/ventures/types';

import { formatSar } from './format-sar';

type Dict = DictionaryShapes['ventures'];

export function VentureCard({
  venture,
  dict,
  locale,
}: {
  venture: VentureSummary;
  dict: Dict;
  locale: Locale;
}) {
  const t = useMemo(() => createTranslator(locale, 'ventures', dict), [locale, dict]);
  const pct = Math.min(100, Math.round((venture.raisedSar / venture.targetSar) * 100));

  return (
    <Link
      href={`/projects/${venture.id}` as Route}
      className="flex flex-col gap-3 rounded-xl border border-edge bg-elevated p-5 transition-colors hover:border-edge-strong"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-widest text-fg-faint">
          {venture.sectors.map((s) => s.name).join(' · ')}
        </span>
        <h3 className="text-body font-semibold text-fg">{venture.name}</h3>
        <p className="text-sm text-fg-muted">{venture.tagline}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs text-fg-faint" dir="ltr">
          {t('card.raisedLabel', {
            raised: formatSar(locale, venture.raisedSar),
            target: formatSar(locale, venture.targetSar),
          })}
        </p>
        <div className="h-1.5 rounded-full bg-base/60">
          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-fg-muted">
        <span dir="ltr">{t('card.backersLabel', { count: venture.backerCount })}</span>
        <span>·</span>
        <span dir="ltr">{t('card.trustLabel', { score: venture.trustScore })}</span>
        <span>·</span>
        <span dir="ltr">{t('card.impactLabel', { pct: venture.impactPct })}</span>
      </div>
    </Link>
  );
}
