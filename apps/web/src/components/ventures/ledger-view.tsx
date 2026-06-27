'use client';

import { useMemo, useState } from 'react';

import { formatDate } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/config';
import { createTranslator, type DictionaryShapes } from '@/lib/i18n/get-dictionary';
import type {
  ChainStatus,
  LedgerEntry,
  LedgerFlag,
  LedgerKind,
  VentureSummary,
} from '@/lib/ventures/types';

import { formatSar } from './format-sar';

type Dict = DictionaryShapes['ventures'];
type KindFilter = LedgerKind | 'all';
type FlagFilter = LedgerFlag | 'all';

export function LedgerView({
  locale,
  dict,
  venture,
  entries,
  chainStatus = 'verified',
}: {
  locale: Locale;
  dict: Dict;
  venture: VentureSummary;
  entries: readonly LedgerEntry[];
  chainStatus?: ChainStatus;
}) {
  const t = useMemo(() => createTranslator(locale, 'ventures', dict), [locale, dict]);
  const [kind, setKind] = useState<KindFilter>('all');
  const [flag, setFlag] = useState<FlagFilter>('all');

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (kind !== 'all' && entry.kind !== kind) return false;
      if (flag !== 'all' && entry.flag !== flag) return false;
      return true;
    });
  }, [entries, kind, flag]);

  const maxBalance = Math.max(1, ...entries.map((e) => e.balanceSar));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-fg-faint">{venture.name}</span>
        <h1 className="text-h1 font-semibold text-fg">{dict.ledger.title}</h1>
        <p className="text-sm text-fg-muted">{dict.ledger.subtitle}</p>
      </header>

      <section className="flex flex-col gap-2 rounded-xl border border-edge bg-elevated p-5">
        <h2 className="text-xs uppercase tracking-widest text-fg-faint">
          {dict.ledger.balanceChartTitle}
        </h2>
        <ul className="flex h-24 items-end gap-1">
          {entries.map((entry) => {
            const height = Math.round((entry.balanceSar / maxBalance) * 100);
            return (
              <li
                key={entry.id}
                title={formatSar(locale, entry.balanceSar)}
                className="flex-1 rounded-t bg-brand/80"
                style={{ height: `${height}%` }}
              />
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <FilterGroup label={dict.ledger.filters.kind}>
          {(['all', 'pledge', 'draw', 'expense', 'refund', 'return'] as const).map((value) => (
            <Chip
              key={value}
              active={kind === value}
              onClick={() => setKind(value)}
              label={dict.ledger.kinds[value]}
            />
          ))}
        </FilterGroup>
        <FilterGroup label={dict.ledger.filters.flag}>
          {(['all', 'none', 'info', 'caution', 'anomaly'] as const).map((value) => (
            <Chip
              key={value}
              active={flag === value}
              onClick={() => setFlag(value)}
              label={dict.ledger.flags[value]}
            />
          ))}
        </FilterGroup>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-edge px-4 py-1.5 text-sm text-fg transition-colors hover:border-edge-strong"
        >
          {dict.ledger.exportCsv}
        </button>
        <button
          type="button"
          className="rounded-md border border-edge px-4 py-1.5 text-sm text-fg transition-colors hover:border-edge-strong"
        >
          {dict.ledger.exportPdf}
        </button>
        <button
          type="button"
          className="rounded-md border border-edge px-4 py-1.5 text-sm text-fg transition-colors hover:border-edge-strong"
        >
          {dict.ledger.verifyChain}
        </button>
        <span className="self-center rounded-full border border-edge px-3 py-0.5 text-xs text-fg-muted">
          {t('ledger.chainStatus', { status: dict.ledger.chainStatuses[chainStatus] })}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-edge bg-elevated p-9 text-center text-sm text-fg-muted">
          {dict.ledger.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge bg-elevated">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-xs uppercase tracking-widest text-fg-faint">
              <tr>
                <th className="px-4 py-3 text-start">{dict.ledger.columns.date}</th>
                <th className="px-4 py-3 text-start">{dict.ledger.columns.kind}</th>
                <th className="px-4 py-3 text-start">{dict.ledger.columns.counterparty}</th>
                <th className="px-4 py-3 text-end">{dict.ledger.columns.amount}</th>
                <th className="px-4 py-3 text-end">{dict.ledger.columns.balance}</th>
                <th className="px-4 py-3 text-start">{dict.ledger.columns.flag}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-edge last:border-b-0">
                  <td className="px-4 py-2 text-xs text-fg-muted">
                    {formatDate(locale, entry.postedAt, 'medium')}
                  </td>
                  <td className="px-4 py-2 text-xs text-fg">{dict.ledger.kinds[entry.kind]}</td>
                  <td className="px-4 py-2 text-xs text-fg-muted">
                    {entry.counterpartyRedacted
                      ? dict.ledger.redactedLabel
                      : entry.counterpartyLabel}
                  </td>
                  <td className="px-4 py-2 text-end text-xs text-fg" dir="ltr">
                    {formatSar(locale, entry.amountSar)}
                  </td>
                  <td className="px-4 py-2 text-end text-xs text-fg" dir="ltr">
                    {formatSar(locale, entry.balanceSar)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <FlagBadge flag={entry.flag} dict={dict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? 'border-brand bg-brand/10 text-fg'
          : 'border-edge text-fg-muted hover:border-edge-strong'
      }`}
    >
      {label}
    </button>
  );
}

function FlagBadge({ flag, dict }: { flag: LedgerFlag; dict: Dict }) {
  const cls =
    flag === 'anomaly'
      ? 'border-danger bg-danger/10 text-fg'
      : flag === 'caution'
        ? 'border-warning bg-warning/10 text-fg'
        : flag === 'info'
          ? 'border-brand bg-brand/10 text-fg'
          : 'border-edge text-fg-muted';
  return (
    <span className={`rounded-full border px-2 py-0.5 ${cls}`}>{dict.ledger.flags[flag]}</span>
  );
}
