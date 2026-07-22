import { API_BASE } from '../_lib/guard';
import { OpRunner } from '../_components/op-runner';
import { StatusBadge } from '../_components/badge';

interface ReconRun {
  id: string;
  windowDays: number;
  scanned: number;
  matched: number;
  mismatched: number;
  skipped: number;
  source: string;
  createdAt: string;
}

/**
 * Reconciliation dashboard — PSP-vs-ledger verdicts over time, plus the
 * counter-drift recompute. Every run is a governed op; the history is the
 * durable ReconciliationRun record. money.reconcile.run scans a window and
 * persists the verdict; money.counters.recompute repairs a project's
 * money-derived figures (its dryRun shows the drift first).
 */
export async function ReconciliationPanel({ opsToken }: { opsToken: string }) {
  let runs: ReconRun[] = [];
  let refused = false;
  try {
    const res = await fetch(`${API_BASE}/v1/ops/money/reconciliation`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const b = (await res.json()) as { items: ReconRun[] };
      runs = b.items;
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض المطابقة.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#8b949e]">
          مطابقة دفتر الأستاذ مع مزوّد الدفع، وكشف انحراف العدّادات. في وضع التجربة (بلا مفتاح PSP) تُحتسب الصفوف كـ«متخطّاة» لا مطابِقة.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <OpRunner opKey="money.reconcile.run" input={{ windowDays: 7, limit: 200 }} triggerLabel="تشغيل مطابقة (٧ أيام)" riskTier="SENSITIVE" />
        </div>
      </div>

      {/* Counter-drift repair — takes a projectId; dryRun shows the drift before writing. */}
      <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
        <p className="mb-2 text-sm font-semibold text-[#e6edf3]">إصلاح انحراف العدّادات</p>
        <p className="mb-3 text-xs text-[#8b949e]">
          يعيد احتساب <code dir="ltr">raised/realized/backersCount</code> ومخزون المكافآت من المصدر الموثوق. المعاينة تُظهر الانحراف قبل الكتابة.
        </p>
        <OpRunner opKey="money.counters.recompute" input={{}} triggerLabel="فحص وإصلاح مشروع" riskTier="SENSITIVE" requiresReason variant="ghost" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">التاريخ</th>
              <th className="px-3 py-2 font-medium">النافذة</th>
              <th className="px-3 py-2 font-medium">مفحوصة</th>
              <th className="px-3 py-2 font-medium">مطابِقة</th>
              <th className="px-3 py-2 font-medium">غير مطابِقة</th>
              <th className="px-3 py-2 font-medium">متخطّاة</th>
              <th className="px-3 py-2 font-medium">النتيجة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {runs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[#8b949e]">
                  لا عمليات مطابقة بعد — شغّل واحدة أعلاه.
                </td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-[11px] text-[#8b949e]">
                  {new Date(r.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.windowDays} يوم</td>
                <td className="px-3 py-2 tabular-nums">{r.scanned}</td>
                <td className="px-3 py-2 tabular-nums text-emerald-300">{r.matched}</td>
                <td className="px-3 py-2 tabular-nums">{r.mismatched}</td>
                <td className="px-3 py-2 tabular-nums text-[#8b949e]">{r.skipped}</td>
                <td className="px-3 py-2">
                  <StatusBadge intent={r.mismatched > 0 ? 'danger' : 'ok'}>
                    {r.mismatched > 0 ? 'انحراف' : 'سليمة'}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
