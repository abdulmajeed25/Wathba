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
  grossHalalas: string;
  providerRef?: string | null;
  providerStatus?: string | null;
  netHalalas: string | null;
  feeWithheldHalalas: string | null;
  status: string;
  failureReason?: string | null;
  zatcaInvoiceId?: string | null;
  sentAt?: string | null;
}

const STATUS_LABEL: Record<string, string> = { SENT: 'مكتملة', PENDING: 'بانتظار الإرسال', SENDING: 'بانتظار التأكيد', FAILED: 'فاشلة' };
const PROVIDER_LABEL: Record<string, string> = { queued: 'في طابور المزود', initiated: 'قيد المعالجة لدى البنك', paid: 'أكد المزود الدفع', failed: 'رفض المزود التحويل', canceled: 'ألغى المزود التحويل', returned: 'أُعيد التحويل؛ يلزم التحقيق' };
const FAILURE_LABEL: Record<string, string> = { 'insufficient-unreserved-funds': 'الرصيد المتاح لا يغطي الالتزامات؛ الصرف موقوف للمطابقة.', 'configuration-incomplete': 'أكمل إعدادات التحويل قبل إعادة المحاولة.', 'provider-outcome-needs-reconciliation': 'النتيجة غير مؤكدة؛ لا تعِد إرسال المبلغ.', 'provider-rejected': 'رفض المزود التحويل؛ راجع المرجع قبل أي إجراء مالي جديد.', 'provider-returned-needs-reconciliation': 'يلزم مطابقة التحويل المعاد.', 'awaiting-provider-confirmation': 'لم يكتمل التحويل بعد.' };

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
  let unavailable = false;
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
    } else unavailable = true;
  } catch {
    unavailable = true;
  }

  if (refused) {
    return (
      <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض الدفعات.
      </p>
    );
  }

  if (unavailable) return (
    <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
      <p>تعذر تحميل الدفعات. لا يمكن تأكيد حالة العمليات الآن.</p>
      <Link href={`/ops/money${qs({ tab: 'payouts', status, cursor })}`} className="mt-2 inline-block underline">إعادة تحميل الدفعات</Link>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="payouts" />
          <select
            aria-label="حالة الدفعات"
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

      <p className="text-xs text-[#8b949e]">الصافي والعمولة يوضحان حساب الدفعة. لا يُعد الصرف مكتملًا حتى يؤكد مزود التحويل الدفع. التحقق يقرأ التحويل المحفوظ دون إرسال مبلغ جديد.</p>
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
                <td className="px-3 py-2 tabular-nums">{formatSar(p.grossHalalas)}</td>
                <td className="px-3 py-2 tabular-nums">{formatSar(p.netHalalas)}</td>
                <td className="px-3 py-2 tabular-nums">{formatSar(p.feeWithheldHalalas)}</td>
                <td className="px-3 py-2">
                  <StatusBadge intent={STATUS_INTENT[p.status] ?? 'muted'}>{STATUS_LABEL[p.status] ?? p.status}</StatusBadge>
                  {p.providerStatus && <span className="block text-xs text-[#8b949e]">{PROVIDER_LABEL[p.providerStatus] ?? 'حالة مزود غير معروفة'}</span>}
                  {p.providerRef && <span dir="ltr" className="block max-w-52 break-all text-[11px] text-[#8b949e]">{p.providerRef}</span>}
                  {p.failureReason && <span className="block text-[11px] text-red-300">{FAILURE_LABEL[p.failureReason] ?? 'تحتاج الدفعة إلى مراجعة الإدارة.'}</span>}
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
                    {p.status === 'FAILED' && !p.providerRef && (
                      <OpRunner
                        opKey="money.payout.retry"
                        input={{ payoutId: p.id }}
                        triggerLabel="إعادة المحاولة"
                        riskTier="MONEY"
                        requiresReason
                        variant="danger"
                      />
                    )}
                    {p.status === 'SENDING' && p.providerRef && (
                      <OpRunner opKey="money.payout.reconcile" input={{ payoutId: p.id }} triggerLabel="التحقق من التحويل" riskTier="MONEY" requiresReason />
                    )}
                    {p.status === 'SENDING' && !p.providerRef && <span className="text-xs text-amber-300">يلزم العثور على مرجع التحويل ومطابقته قبل المتابعة.</span>}
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
