'use client';

import { useState } from 'react';

import { OpRunner } from '../_components/op-runner';
import { StatusBadge } from '../_components/badge';
import { formatSar } from '../_lib/money';

/**
 * OPS Phase 2 — «الإعدادات» per-key editor. The catalog is deliberately small
 * (settings.catalog.ts): two pledge bounds, the payment-method flags, the
 * support inbox email. Each control captures the edited value in local state
 * and feeds it to a governed <OpRunner opKey="settings.update">; the runner's
 * dry-run shows before(effective)/after and demands a written reason
 * (SENSITIVE). A `source` badge distinguishes a DB override from the default.
 */

export interface SettingItem {
  key: string;
  titleAr: string;
  descriptionAr: string;
  value: unknown;
  source: 'db' | 'default';
}

const INPUT =
  'rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm outline-none focus:border-emerald-500';

function SourceBadge({ source }: { source: 'db' | 'default' }) {
  return source === 'db' ? (
    <StatusBadge intent="info">قاعدة البيانات</StatusBadge>
  ) : (
    <StatusBadge intent="muted">الافتراضي</StatusBadge>
  );
}

function Shell({
  item,
  children,
  value,
  disabled,
}: {
  item: SettingItem;
  children: React.ReactNode;
  value: unknown;
  disabled?: boolean;
}) {
  const reload = () => window.location.reload();
  return (
    <div className="space-y-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">{item.titleAr}</h3>
          <code dir="ltr" className="text-[11px] text-[#8b949e]">
            {item.key}
          </code>
        </div>
        <SourceBadge source={item.source} />
      </div>
      <p className="text-xs text-[#8b949e]">{item.descriptionAr}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      <OpRunner
        opKey="settings.update"
        input={{ key: item.key, value }}
        triggerLabel="حفظ التغيير"
        riskTier="SENSITIVE"
        requiresReason
        variant="primary"
        disabled={disabled}
        onDone={reload}
      />
    </div>
  );
}

function MinHalalasRow({ item }: { item: SettingItem }) {
  const [v, setV] = useState<string>(String((item.value as number | null) ?? ''));
  const n = Number(v);
  const valid = v !== '' && Number.isInteger(n) && n > 0;
  return (
    <Shell item={item} value={valid ? n : null} disabled={!valid}>
      <input
        type="number"
        min={1}
        step={1}
        value={v}
        onChange={(e) => setV(e.target.value)}
        className={INPUT}
        dir="ltr"
      />
      <span className="text-xs text-[#8b949e]">هللة {valid ? `= ${formatSar(n)}` : ''}</span>
    </Shell>
  );
}

function MaxHalalasRow({ item }: { item: SettingItem }) {
  const initial = item.value as number | null;
  const [noCap, setNoCap] = useState<boolean>(initial === null);
  const [v, setV] = useState<string>(initial === null ? '' : String(initial));
  const n = Number(v);
  const valueValid = noCap || (v !== '' && Number.isInteger(n) && n > 0);
  const value = noCap ? null : valueValid ? n : null;
  return (
    <Shell item={item} value={value} disabled={!valueValid}>
      <label className="flex items-center gap-2 text-xs text-[#8b949e]">
        <input
          type="checkbox"
          checked={noCap}
          onChange={(e) => setNoCap(e.target.checked)}
          className="h-4 w-4 accent-emerald-600"
        />
        بلا سقف
      </label>
      <input
        type="number"
        min={1}
        step={1}
        value={v}
        disabled={noCap}
        onChange={(e) => setV(e.target.value)}
        className={`${INPUT} disabled:opacity-40`}
        dir="ltr"
      />
      <span className="text-xs text-[#8b949e]">
        {noCap ? 'null' : valueValid ? `هللة = ${formatSar(n)}` : 'هللة'}
      </span>
    </Shell>
  );
}

function MethodsRow({ item }: { item: SettingItem }) {
  const initial = (item.value as { card?: boolean; bnpl?: boolean } | null) ?? {};
  const [card, setCard] = useState<boolean>(initial.card ?? false);
  const [bnpl, setBnpl] = useState<boolean>(initial.bnpl ?? false);
  return (
    <Shell item={item} value={{ card, bnpl }}>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={card}
          onChange={(e) => setCard(e.target.checked)}
          className="h-4 w-4 accent-emerald-600"
        />
        البطاقة (card)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={bnpl}
          onChange={(e) => setBnpl(e.target.checked)}
          className="h-4 w-4 accent-emerald-600"
        />
        التقسيط (bnpl)
      </label>
    </Shell>
  );
}

function EmailRow({ item }: { item: SettingItem }) {
  const [v, setV] = useState<string>(String((item.value as string | null) ?? ''));
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  return (
    <Shell item={item} value={v} disabled={!valid}>
      <input
        type="email"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className={INPUT}
        dir="ltr"
      />
    </Shell>
  );
}

export function SettingRow({ item }: { item: SettingItem }) {
  switch (item.key) {
    case 'pledges.minHalalas':
      return <MinHalalasRow item={item} />;
    case 'pledges.maxHalalas':
      return <MaxHalalasRow item={item} />;
    case 'payments.methodsEnabled':
      return <MethodsRow item={item} />;
    case 'support.inboxEmail':
      return <EmailRow item={item} />;
    default:
      // Unknown key — render read-only JSON so the screen never hides a
      // catalog addition it doesn't yet have a control for.
      return (
        <div className="space-y-2 rounded-lg border border-[#21262d] bg-[#161b22] p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">{item.titleAr}</h3>
            <SourceBadge source={item.source} />
          </div>
          <pre dir="ltr" className="overflow-x-auto rounded bg-[#0d1117] p-2 text-xs text-[#8b949e]">
            {JSON.stringify(item.value, null, 2)}
          </pre>
        </div>
      );
  }
}
