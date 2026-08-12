import Link from 'next/link';

import { API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { formatSar } from '../_lib/money';
import { OpRunner } from '../_components/op-runner';

interface LedgerRow {
  id: string;
  entryType: string;
  amountHalalas: string;
  pspRef: string;
  pledgeId?: string | null;
  payoutId?: string | null;
  projectId?: string | null;
  source: string;
  createdAt: string;
}

const ENTRY_TYPES = ['HOLD_AUTHORIZED', 'CAPTURE', 'VOID', 'REFUND', 'PAYOUT_SENT', 'DISPUTE', 'COMMISSION'];

/**
 * The ledger explorer — the append-only money journal (DB-enforced). Filter by
 * type / project / date. Read-only browsing; the only write affordance is the
 * governed, evidence-gated money.ledger.backfill op for a proven journal gap.
 */
export async function LedgerBrowser({
  opsToken,
  cursor,
  entryType,
  projectId,
  from,
  to,
}: {
  opsToken: string;
  cursor?: string;
  entryType?: string;
  projectId?: string;
  from?: string;
  to?: string;
}) {
  let rows: LedgerRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  try {
    const res = await fetch(
      `${API_BASE}/v1/ops/money/ledger${qs({ entryType, projectId, from, to, cursor, limit: '50' })}`,
      { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
    );
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const b = (await res.json()) as { items: LedgerRow[]; nextCursor: string | null };
      rows = b.items;
      nextCursor = b.nextCursor;
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض دفتر الأستاذ.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value="ledger" />
          <select
            name="entryType"
            defaultValue={entryType ?? ''}
            className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
          >
            <option value="">كل الأنواع</option>
            {ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            name="projectId"
            defaultValue={projectId ?? ''}
            placeholder="مُعرّف المشروع"
            className="w-48 rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
            dir="ltr"
          />
          <input type="date" name="from" defaultValue={from ?? ''} className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-[#e6edf3]" />
          <input type="date" name="to" defaultValue={to ?? ''} className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-[#e6edf3]" />
          <button className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]">
            تصفية
          </button>
        </form>
        <OpRunner
          opKey="money.ledger.backfill"
          input={{}}
          triggerLabel="تصحيح فجوة (backfill)"
          riskTier="MONEY"
          requiresReason
          variant="ghost"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">النوع</th>
              <th className="px-3 py-2 font-medium">المبلغ</th>
              <th className="px-3 py-2 font-medium">المرجع (PSP)</th>
              <th className="px-3 py-2 font-medium">المصدر</th>
              <th className="px-3 py-2 font-medium">مرتبط بـ</th>
              <th className="px-3 py-2 font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#8b949e]">
                  لا قيود مطابقة.
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">
                  {e.entryType}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatSar(e.amountHalalas)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-[#8b949e]" dir="ltr">
                  {e.pspRef.slice(0, 18)}
                </td>
                <td className="px-3 py-2 text-[#8b949e]" dir="ltr">
                  {e.source}
                </td>
                <td className="px-3 py-2">
                  {e.projectId ? (
                    <Link href={`/ops/projects/${e.projectId}`} className="text-[#58a6ff] hover:underline font-mono text-[11px]">
                      {e.projectId.slice(0, 8)}…
                    </Link>
                  ) : (
                    <span className="text-[#484f58]">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[11px] text-[#8b949e]">
                  {new Date(e.createdAt).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <Link
          href={`/ops/money${qs({ tab: 'ledger', entryType, projectId, from, to, cursor: nextCursor })}`}
          className="inline-block text-sm text-[#58a6ff] hover:underline"
        >
          الأقدم ↓
        </Link>
      )}
    </section>
  );
}
