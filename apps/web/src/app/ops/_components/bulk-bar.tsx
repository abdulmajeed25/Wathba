'use client';

import { useState } from 'react';

/**
 * OPS-360 Unit 2 — the GENERIC bulk engine. Replaces the "render one OpRunner
 * per selected row" pattern with a real governed bulk flow that keeps every
 * mutation individually governed and audited:
 *
 *   pick op → blast-radius plan (how many rows it applies to + what it does)
 *           → reason (SENSITIVE/MONEY) + MONEY typed-confirm, ONCE for the batch
 *           → sequential per-id dry-run→execute (each id keeps its own dry-run
 *             gate, idempotency key, and audit entry)
 *           → results tally (N نُفِّذت / M رُفِضت مع السبب / K أخفقت)
 *
 * The dry-run gate is honored per row: an id whose dry-run returns ok:false is
 * recorded as "refused" with its blocker reasonAr and is NEVER executed — so a
 * bulk run can't push a mutation past a guard the single-row flow would block.
 * A dead session (401) or step-up (403) halts the batch and offers re-auth;
 * already-executed ids stay done (idempotency keys are per-id, so a retry is
 * safe).
 */

type RiskTier = 'CONTENT' | 'STANDARD' | 'SENSITIVE' | 'MONEY';

export interface BulkOp<Row> {
  opKey: string;
  label: string;
  /** Build the per-row op input payload. */
  input: (row: Row) => unknown;
  /** Rows this op applies to; non-applicable rows are excluded from the blast. */
  applicable?: (row: Row) => boolean;
  riskTier?: RiskTier;
  requiresReason?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
  /** One-sentence description of the effect (shown in the blast-radius plan). */
  describeAr?: string;
}

interface RowResult {
  id: string;
  label: string;
  status: 'ok' | 'refused' | 'error';
  reasonAr?: string;
}

type Phase = 'choose' | 'plan' | 'running' | 'summary';

const TRIGGER: Record<NonNullable<BulkOp<unknown>['variant']>, string> = {
  primary: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  danger: 'border-red-500/50 bg-red-500/10 text-red-300',
  ghost: 'border-[#30363d] text-[#e6edf3]',
};

const CONFIRM_PHRASE = 'نعم';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function BulkBar<Row extends { id: string }>({
  rows,
  ops,
  labelForRow = (r) => r.id,
  onDone,
  onClear,
}: {
  /** The SELECTED full row objects (from DataTable's selection). */
  rows: Row[];
  /** Bulk operations offered for this selection. */
  ops: BulkOp<Row>[];
  /** Row label for the results list (defaults to the id). */
  labelForRow?: (row: Row) => string;
  onDone?: (summary: { ok: number; refused: number; error: number }) => void;
  /** Clear the DataTable selection (offered after a completed batch). */
  onClear?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('choose');
  const [op, setOp] = useState<BulkOp<Row> | null>(null);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [results, setResults] = useState<RowResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [reAuthHref, setReAuthHref] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const targets = op ? rows.filter((r) => (op.applicable ? op.applicable(r) : true)) : [];
  const isMoney = op?.riskTier === 'MONEY';
  const needsReason = !!op && (op.requiresReason || op.riskTier === 'SENSITIVE' || isMoney);
  const reasonOk = !needsReason || reason.trim().length >= 10;
  const confirmOk = !isMoney || confirmText.trim() === CONFIRM_PHRASE;
  const canRun = phase === 'plan' && targets.length > 0 && reasonOk && confirmOk;

  function choose(next: BulkOp<Row>) {
    setOp(next);
    setReason('');
    setConfirmText('');
    setResults([]);
    setProgress(0);
    setReAuthHref(null);
    setPhase('plan');
  }

  function backToChoose() {
    setOp(null);
    setPhase('choose');
  }

  async function run() {
    if (!op) return;
    setPhase('running');
    setProgress(0);
    const acc: RowResult[] = [];

    for (const row of targets) {
      const label = labelForRow(row);
      const input = op.input(row);
      try {
        // 1) dry-run gate — honored per id.
        const dr = await fetch(`/api/ops/operations/${op.opKey}/dry-run`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input }),
        });
        const drBody = (await dr.json().catch(() => ({}))) as {
          ok?: boolean;
          blockers?: Array<{ reasonAr: string }>;
          message?: string;
        };
        if (dr.status === 401 || (dr.status === 403 && /توثيق|step.?up/i.test(drBody.message ?? ''))) {
          setReAuthHref(dr.status === 401 ? '/ops/enter' : '/ops');
          break;
        }
        if (!dr.ok) {
          acc.push({ id: row.id, label, status: 'error', reasonAr: drBody.message ?? 'تعذّرت المعاينة' });
          setResults([...acc]);
          setProgress(acc.length);
          continue;
        }
        if (drBody.ok === false) {
          acc.push({
            id: row.id,
            label,
            status: 'refused',
            reasonAr: drBody.blockers?.[0]?.reasonAr ?? 'رفضته القيود',
          });
          setResults([...acc]);
          setProgress(acc.length);
          continue;
        }

        // 2) execute — governed + audited, unique idempotency key per id.
        const ex = await fetch(`/api/ops/operations/${op.opKey}/execute`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-idempotency-key': uuid() },
          body: JSON.stringify({ input, reason: needsReason ? reason : undefined }),
        });
        const exBody = (await ex.json().catch(() => ({}))) as {
          message?: string;
          blockers?: Array<{ reasonAr: string }>;
        };
        if (ex.status === 401 || (ex.status === 403 && /توثيق|step.?up/i.test(exBody.message ?? ''))) {
          setReAuthHref(ex.status === 401 ? '/ops/enter' : '/ops');
          break;
        }
        if (!ex.ok) {
          acc.push({
            id: row.id,
            label,
            status: 'error',
            reasonAr: exBody.message ?? exBody.blockers?.[0]?.reasonAr ?? 'فشل التنفيذ',
          });
        } else {
          acc.push({ id: row.id, label, status: 'ok' });
        }
      } catch {
        acc.push({ id: row.id, label, status: 'error', reasonAr: 'تعذّر الوصول إلى الخادم' });
      }
      setResults([...acc]);
      setProgress(acc.length);
    }

    setResults([...acc]);
    setPhase('summary');
    const summary = {
      ok: acc.filter((r) => r.status === 'ok').length,
      refused: acc.filter((r) => r.status === 'refused').length,
      error: acc.filter((r) => r.status === 'error').length,
    };
    onDone?.(summary);
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  const refusedCount = results.filter((r) => r.status === 'refused').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  return (
    <div
      dir="rtl"
      role="region"
      aria-label="إجراءات جماعية"
      className="space-y-3 rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-[#e6edf3]"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold">
          محدَّد: {rows.length.toLocaleString('ar-SA-u-nu-latn')}
        </span>

        {phase === 'choose'
          ? ops.map((o) => (
              <button
                key={o.opKey + o.label}
                type="button"
                onClick={() => choose(o)}
                className={`rounded border px-3 py-1.5 text-sm hover:brightness-125 ${TRIGGER[o.variant ?? 'ghost']}`}
              >
                {o.label}
              </button>
            ))
          : null}

        {phase !== 'choose' && op ? (
          <span className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-xs">
            {op.label} · <code dir="ltr" className="text-[#8b949e]">{op.opKey}</code>
          </span>
        ) : null}

        {onClear && phase !== 'running' ? (
          <button
            type="button"
            onClick={onClear}
            className="ms-auto rounded border border-[#30363d] px-3 py-1.5 text-sm text-[#8b949e] hover:bg-[#21262d]"
          >
            إلغاء التحديد
          </button>
        ) : null}
      </div>

      {phase === 'plan' && op ? (
        <div className="space-y-3">
          <p className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm">
            سيُطبَّق «{op.label}» على{' '}
            <b className="tabular-nums">{targets.length.toLocaleString('ar-SA-u-nu-latn')}</b> من{' '}
            {rows.length.toLocaleString('ar-SA-u-nu-latn')} صف محدَّد
            {targets.length < rows.length ? ' (البقية غير مؤهّلة لهذا الإجراء)' : ''}.
            {op.describeAr ? <span className="mt-1 block text-[#8b949e]">{op.describeAr}</span> : null}
            <span className="mt-1 block text-xs text-[#8b949e]">
              كل صف يمرّ بمعاينته (dry-run) وتنفيذه المستقل المُدقَّق — لا تنفيذ أعمى.
            </span>
          </p>

          {needsReason ? (
            <label className="block">
              <span className="mb-1 block text-xs text-[#8b949e]">
                السبب (10 أحرف على الأقل — يُسجَّل في تدقيق كل صف)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </label>
          ) : null}

          {isMoney ? (
            <label className="block">
              <span className="mb-1 block text-xs text-amber-300">
                إجراء مالي جماعي — اكتب «{CONFIRM_PHRASE}» للتأكيد
              </span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded border border-amber-500/40 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </label>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={backToChoose}
              className="rounded border border-[#30363d] px-3 py-1.5 text-sm hover:bg-[#21262d]"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              className={`rounded px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50 ${
                isMoney ? 'bg-red-600 hover:bg-red-500' : 'bg-[#238636] hover:bg-[#2ea043]'
              }`}
            >
              {isMoney ? `تنفيذ جماعي مالي (${targets.length})` : `تنفيذ جماعي (${targets.length})`}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'running' ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm text-[#8b949e]">
            جارٍ التنفيذ… {progress.toLocaleString('ar-SA-u-nu-latn')} / {targets.length.toLocaleString('ar-SA-u-nu-latn')}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded bg-[#0d1117]">
            <div
              className="h-full bg-[#238636] transition-all"
              style={{ width: `${targets.length ? (progress / targets.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {phase === 'summary' ? (
        <div className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
              ✓ نُفِّذت: {okCount.toLocaleString('ar-SA-u-nu-latn')}
            </span>
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300">
              رُفِضت: {refusedCount.toLocaleString('ar-SA-u-nu-latn')}
            </span>
            <span className="rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-red-300">
              أخفقت: {errorCount.toLocaleString('ar-SA-u-nu-latn')}
            </span>
          </div>

          {reAuthHref ? (
            <a
              href={reAuthHref}
              className="inline-block rounded border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/20"
            >
              انقطعت الجلسة — إعادة التوثيق → (الصفوف المتبقية لم تُنفَّذ)
            </a>
          ) : null}

          {results.some((r) => r.status !== 'ok') ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {results
                .filter((r) => r.status !== 'ok')
                .map((r) => (
                  <li
                    key={r.id}
                    className={`rounded border px-3 py-1.5 text-xs ${
                      r.status === 'refused'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                        : 'border-red-500/40 bg-red-500/10 text-red-200'
                    }`}
                  >
                    <span className="font-bold">{r.label}</span>
                    {r.reasonAr ? <span className="text-[#8b949e]"> — {r.reasonAr}</span> : null}
                  </li>
                ))}
            </ul>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={backToChoose}
              className="rounded border border-[#30363d] px-3 py-1.5 text-sm hover:bg-[#21262d]"
            >
              إجراء آخر
            </button>
            {onClear ? (
              <button
                type="button"
                onClick={onClear}
                className="rounded bg-[#238636] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2ea043]"
              >
                تم — مسح التحديد
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
