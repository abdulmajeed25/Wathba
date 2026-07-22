import Link from 'next/link';

import { API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { formatSar } from '../_lib/money';
import { StatusBadge } from '../_components/badge';
import { OpRunner } from '../_components/op-runner';

interface PayoutRow {
  id: string;
  projectId: string;
  // The read API joins the creator nested (ops-read.service.ts:467).
  creator?: { id: string; name: string | null; handle: string | null } | null;
  amountHalalas: string;
  netHalalas: string | null;
  feeWithheldHalalas: string | null;
  status: string;
  failureReason?: string | null;
  zatcaInvoiceId?: string | null;
  sentAt?: string | null;
}

const STATUS_INTENT: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'muted'> = {
  SENT: 'ok',
  PENDING: 'warn',
  SENDING: 'info',
  FAILED: 'danger',
};

/**
 * Payout console: the pending/failed queue, the disburse cycle (net/withheld
 * preview via dryRun), per-payout retry of FAILED rows, and ZATCA-orphan
 * repair. Every button is a governed MONEY op through <OpRunner>.
 */
export async function PayoutsPanel({
  opsToken,
  cursor,
  status,
}: {
  opsToken: string;
  cursor?: string;
  status?: string;
}) {
  let rows: PayoutRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  try {
    const res = await fetch(
      `${API_BASE}/v1/ops/money/payouts${qs({ status, cursor, limit: '50' })}`,
      { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
    );
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const b = (await res.json()) as { items: PayoutRow[]; nextCursor: string | null };
      rows = b.items;
      nextCursor = b.nextCursor;
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض الدفعات.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="payouts" />
          <select
            name="status"
            defaultValue={status ?? ''}
            className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
          >
            <option value="">كل الحالات</option>
            <option value="PENDING">معلّقة</option>
            <option value="SENDING">جارٍ الإرسال</option>
            <option value="SENT">مُرسلة</option>
            <option value="FAILED">فاشلة</option>
          </select>
          <button className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]">
            تصفية
          </button>
        </form>
        {/* Run the disburse cycle — a MONEY op; dryRun shows net vs withheld before it sends. */}
        <OpRunner
          opKey="money.payout.disburse"
          input={{}}
          triggerLabel="تشغيل دورة الصرف"
          riskTier="MONEY"
          requiresReason
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">المشروع</th>
              <th className="px-3 py-2 font-medium">الإجمالي</th>
              <th className="px-3 py-2 font-medium">الصافي</th>
              <th className="px-3 py-2 font-medium">المحتجز</th>
              <th className="px-3 py-2 font-medium">الحالة</th>
              <th className="px-3 py-2 font-medium">ZATCA</th>
              <th className="px-3 py-2 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[#8b949e]">
                  لا دفعات مطابقة.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">
                  <Link href={`/ops/projects/${p.projectId}`} className="text-[#58a6ff] hover:underline">
                    {p.creator?.name ?? p.creator?.handle ?? `${p.projectId.slice(0, 8)}…`}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatSar(p.amountHalalas)}</td>
                <td className="px-3 py-2 tabular-nums">{formatSar(p.netHalalas)}</td>
                <td className="px-3 py-2 tabular-nums">{formatSar(p.feeWithheldHalalas)}</td>
                <td className="px-3 py-2">
                  <StatusBadge intent={STATUS_INTENT[p.status] ?? 'muted'}>{p.status}</StatusBadge>
                  {p.failureReason && <span className="block text-[11px] text-red-300">{p.failureReason}</span>}
                </td>
                <td className="px-3 py-2">
                  {p.status === 'SENT' && !p.zatcaInvoiceId ? (
                    <span className="text-[11px] text-amber-300">فاتورة مفقودة</span>
                  ) : p.zatcaInvoiceId ? (
                    <span className="font-mono text-[11px] text-[#8b949e]" dir="ltr">
                      {p.zatcaInvoiceId}
                    </span>
                  ) : (
                    <span className="text-[#484f58]">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {p.status === 'FAILED' && (
                      <OpRunner
                        opKey="money.payout.retry"
                        input={{ payoutId: p.id }}
                        triggerLabel="إعادة المحاولة"
                        riskTier="MONEY"
                        requiresReason
                        variant="danger"
                      />
                    )}
                    {p.status === 'SENT' && !p.zatcaInvoiceId && (
                      <OpRunner
                        opKey="money.zatca.retry"
                        input={{ payoutId: p.id }}
                        triggerLabel="إصدار الفاتورة"
                        riskTier="SENSITIVE"
                        variant="ghost"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <Link
          href={`/ops/money${qs({ tab: 'payouts', status, cursor: nextCursor })}`}
          className="inline-block text-sm text-[#58a6ff] hover:underline"
        >
          الأقدم ↓
        </Link>
      )}
    </section>
  );
}
