import Link from 'next/link';

import { API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { formatSar } from '../_lib/money';
import { StatusBadge } from '../_components/badge';

interface ZatcaRow {
  id: string;
  invoiceNumber: string | null;
  payoutId: string;
  creatorId?: string | null;
  vatHalalas: string | null;
  commissionHalalas?: string | null;
  reportedAt: string | null;
  orphan: boolean;
  createdAt: string;
}

/**
 * OPS-360 Unit 3 — ZATCA invoice browser. The census found no invoice
 * surface: reportedAt-null rows (the Fatoora backfill queue) were invisible
 * everywhere. This lists invoices with a `reported`/orphan filter; a
 * SENT-payout missing its invoice is repaired from the payouts tab via
 * money.zatca.retry (linked here).
 */
export async function ZatcaPanel({
  opsToken,
  cursor,
  reported,
}: {
  opsToken: string;
  cursor?: string;
  reported?: string;
}) {
  let rows: ZatcaRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  try {
    const res = await fetch(`${API_BASE}/v1/ops/money/zatca-invoices${qs({ reported, cursor, limit: '50' })}`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const b = (await res.json()) as { items: ZatcaRow[]; nextCursor: string | null };
      rows = b.items;
      nextCursor = b.nextCursor;
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض الفواتير الضريبية.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="zatca" />
          <select
            name="reported"
            defaultValue={reported ?? ''}
            className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
          >
            <option value="">كل الفواتير</option>
            <option value="false">بانتظار الإبلاغ (Fatoora)</option>
            <option value="true">مُبلَّغة</option>
          </select>
          <button className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]">
            تصفية
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">رقم الفاتورة</th>
              <th className="px-3 py-2 font-medium">الدفعة</th>
              <th className="px-3 py-2 font-medium">ضريبة القيمة المضافة</th>
              <th className="px-3 py-2 font-medium">الإبلاغ (Fatoora)</th>
              <th className="px-3 py-2 font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#8b949e]">
                  لا فواتير مطابقة.
                </td>
              </tr>
            )}
            {rows.map((z) => (
              <tr key={z.id}>
                <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">{z.invoiceNumber ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-[#8b949e]" dir="ltr">{z.payoutId.slice(0, 8)}…</td>
                <td className="px-3 py-2 tabular-nums">{formatSar(z.vatHalalas)}</td>
                <td className="px-3 py-2">
                  {z.reportedAt ? (
                    <StatusBadge intent="ok">مُبلَّغة</StatusBadge>
                  ) : (
                    <StatusBadge intent="warn">بانتظار الإبلاغ</StatusBadge>
                  )}
                </td>
                <td className="px-3 py-2 text-[11px] text-[#8b949e]">
                  {new Date(z.createdAt).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#8b949e]">
        دفعة <StatusBadge intent="ok">SENT</StatusBadge> بلا فاتورة (يتيمة) تُعالَج من تبويب «الدفعات» عبر{' '}
        <Link href="/ops/money?tab=payouts" className="text-[#58a6ff] hover:underline">money.zatca.retry</Link>.
        الإبلاغ إلى منصّة فاتورة (Fatoora) عمل خارجي معلّق على شهادة CSID.
      </p>

      {nextCursor && (
        <a href={`/ops/money${qs({ tab: 'zatca', reported, cursor: nextCursor })}`} className="inline-block text-sm text-[#58a6ff] hover:underline">
          الأقدم ↓
        </a>
      )}
    </section>
  );
}
