import Link from 'next/link';

import { API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { formatSar } from '../_lib/money';
import { StatusBadge } from '../_components/badge';
import { OpRunner } from '../_components/op-runner';
import { RefundVerificationAction } from './refund-verification-action';

interface PledgeRow {
  id: string;
  projectId: string;
  // The read API returns the backer nested + PII-masked (ops-read.service.ts:436).
  backer?: { id: string; name: string; email: string | null } | null;
  amountHalalas: string;
  addOnsHalalas: string;
  status: string;
  paymentMethod: string;
  authorizationIssue?: string | null;
  authorizationRecoverable?: boolean;
  refundRequestedAt?: string | null;
  refundReservedHalalas?: string | null;
  refundIssue?: string | null;
  createdAt: string;
}

function pendingHeld(p: PledgeRow): boolean {
  return ['HELD', 'PENDING_REAUTH', 'CAPTURE_GRACE'].includes(p.status) && /^payment:(CAPTURE|VOID|REAUTHORIZE|AUTHORIZE):[0-9a-f-]{36}$/.test(p.authorizationIssue ?? '');
}

const STATUS_LABEL: Record<string, string> = { PENDING_AUTH: 'حجز قيد التحقق', HELD: 'محجوز', PENDING_REAUTH: 'بانتظار إعادة التفويض', CAPTURED: 'تم التحصيل', PENDING_BNPL: 'بانتظار التقسيط', CAPTURE_GRACE: 'مهلة التحصيل', FAILED_CAPTURE: 'تعذر التحصيل', REFUNDED: 'أعيد المبلغ', DISPUTED: 'متنازع عليه', FAILED: 'فشل' };
const METHOD_LABEL: Record<string, string> = { CARD: 'بطاقة', BNPL: 'تقسيط', WALLET: 'محفظة' };

const STATUS_INTENT: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'muted'> = {
  PENDING_AUTH: 'warn',
  CAPTURED: 'ok',
  HELD: 'info',
  CAPTURE_GRACE: 'warn',
  FAILED_CAPTURE: 'danger',
  REFUNDED: 'muted',
  DISPUTED: 'danger',
};

const AUTHORIZATION_ISSUES: Record<string, string> = {
  'authorization-outcome-unknown': 'لم تصل نتيجة الحجز؛ يلزم التحقق لدى المزود قبل إعادة الدفع.',
  'authorization-challenge': 'بانتظار إكمال الداعم للتحقق لدى البنك من حسابه.',
  'authorization-terms-changed': 'تعذر احتساب الحجز وفق شروطه الأصلية؛ يلزم مراجعة الفرق أو فك الحجز.',
  'finalization-outcome-unknown': 'نتيجة حفظ التعهد غير مؤكدة؛ يلزم مطابقة الحالة والسجل المالي.',
  'void-outcome-unknown': 'لم يتأكد فك الحجز؛ لا يُعد المبلغ مستردًا حتى التحقق.',
  'void-awaiting-confirmation': 'سُجل طلب فك الحجز؛ ننتظر نتيجة مؤكدة قبل إغلاقه.',
  'void-not-confirmed': 'آخر قراءة لم تثبت فك الحجز؛ التعهد غير محتسب ولا يُعاد الطلب تلقائيًا.',
};

/**
 * Refunds + failed-capture recovery. Single-pledge refund, project-wide bulk
 * refund (blast-radius shown in the op's dryRun), the failed-capture cohort
 * retry, single-pledge revive, and dispute resolution — all governed MONEY
 * ops through <OpRunner>. PII stays masked (backer email from the read API).
 */
export async function RefundsPanel({
  opsToken,
  cursor,
  status,
  projectId,
}: {
  opsToken: string;
  cursor?: string;
  status?: string;
  projectId?: string;
}) {
  let rows: PledgeRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  let unavailable = false;
  try {
    const res = await fetch(
      `${API_BASE}/v1/ops/money/pledges${qs({ status, projectId, cursor, limit: '50' })}`,
      { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
    );
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const b = (await res.json()) as { items: PledgeRow[]; nextCursor: string | null };
      rows = b.items;
      nextCursor = b.nextCursor;
    } else unavailable = true;
  } catch {
    unavailable = true;
  }

  if (refused) {
    return (
      <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض التعهدات.
      </p>
    );
  }

  if (unavailable) return (
    <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
      <p>تعذر تحميل التعهدات. لا يمكن تأكيد حالة العمليات الآن.</p>
      <Link href={`/ops/money${qs({ tab: 'refunds', status, cursor, projectId })}`} className="mt-2 inline-block underline">إعادة تحميل التعهدات</Link>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value="refunds" />
          <input
            aria-label="معرّف المشروع"
            name="projectId"
            defaultValue={projectId ?? ''}
            placeholder="مُعرّف المشروع"
            className="w-56 rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
            dir="ltr"
          />
          <select
            aria-label="حالة التعهدات"
            name="status"
            defaultValue={status ?? ''}
            className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
          >
            <option value="">كل الحالات</option>
            <option value="PENDING_AUTH">حجز قيد التحقق — غير محتسب</option>
            <option value="HELD">محجوزة</option>
            <option value="PENDING_BNPL">بانتظار التقسيط</option>
            <option value="PENDING_REAUTH">بانتظار إعادة التفويض</option>
            <option value="REFUND_PENDING">استرداد بانتظار المطابقة</option>
            <option value="CAPTURED">مقطوفة</option>
            <option value="CAPTURE_GRACE">مهلة التقاط</option>
            <option value="FAILED_CAPTURE">التقاط فاشل</option>
            <option value="DISPUTED">متنازَع عليها</option>
            <option value="REFUNDED">مُستردَّة</option>
            <option value="FAILED">فاشلة</option>
          </select>
          <button className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]">
            تصفية
          </button>
        </form>

        {/* Project-scoped bulk ops — only meaningful when a project is in scope. */}
        {projectId && (
          <div className="flex flex-wrap gap-1.5">
            <OpRunner
              opKey="money.refund.project"
              input={{ projectId }}
              triggerLabel="استرداد المشروع بالكامل"
              riskTier="MONEY"
              requiresReason
              variant="danger"
            />
            <OpRunner
              opKey="money.capture.retry-cohort"
              input={{ projectId, includeFailed: true }}
              triggerLabel="إعادة التقاط المتعثرين"
              riskTier="MONEY"
              requiresReason
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">المشروع</th>
              <th className="px-3 py-2 font-medium">الداعم</th>
              <th className="px-3 py-2 font-medium">المبلغ</th>
              <th className="px-3 py-2 font-medium">الوسيلة</th>
              <th className="px-3 py-2 font-medium">الحالة</th>
              <th className="px-3 py-2 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#8b949e]">
                  لا تعهدات مطابقة.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">
                  <Link href={`/ops/projects/${p.projectId}`} className="text-[#58a6ff] hover:underline font-mono text-[11px]">
                    {p.projectId.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-3 py-2 text-[#8b949e]" dir="ltr">
                  {p.backer?.email ?? '—'}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatSar((BigInt(p.amountHalalas) + BigInt(p.addOnsHalalas ?? '0')).toString())}</td>
                <td className="px-3 py-2">{METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</td>
                <td className="px-3 py-2">
                  <StatusBadge intent={pendingHeld(p) ? 'warn' : p.refundRequestedAt && p.status !== 'REFUNDED' ? 'warn' : STATUS_INTENT[p.status] ?? 'muted'}>
                    {pendingHeld(p) ? 'عملية مالية قيد التحقق' : p.refundRequestedAt && p.status !== 'REFUNDED' ? 'استرداد قيد التحقق' : STATUS_LABEL[p.status] ?? p.status}
                  </StatusBadge>
                  {p.refundRequestedAt && p.status !== 'REFUNDED' && <p className="mt-1 max-w-xs text-xs text-amber-300">
                    استرداد بانتظار المطابقة. حُجز {formatSar(p.refundReservedHalalas)} لهذه المحاولة؛ لا تعِد إرسال طلب الاسترداد قبل حسم نتيجته.
                  </p>}
                  {p.refundIssue === 'refund-partial-needs-review' && <p className="mt-1 max-w-xs text-xs text-amber-300">أفاد المزود برد جزء من المبلغ؛ لم يُعتمد الرد الكامل، ويلزم مراجعة الفرق.</p>}
                  {p.refundIssue === 'refund-not-confirmed' && <p className="mt-1 max-w-xs text-xs text-amber-300">آخر تحقق لم يؤكد الاسترداد؛ الحجز قائم.</p>}
                  {pendingHeld(p) && <p className="mt-1 max-w-xs text-xs text-amber-300">
                    توجد محاولة {p.authorizationIssue?.startsWith('payment:CAPTURE:') ? 'تحصيل' : p.authorizationIssue?.startsWith('payment:VOID:') ? 'فك حجز' : p.authorizationIssue?.startsWith('payment:AUTHORIZE:') ? 'تفويض بطاقة جديدة' : 'تجديد تفويض'} لم تُحسم. تحقّق من نتيجتها قبل أي طلب مالي آخر.
                  </p>}
                  {p.status === 'PENDING_AUTH' && <p className="mt-1 max-w-xs text-xs text-amber-300">
                    {p.authorizationIssue ? AUTHORIZATION_ISSUES[p.authorizationIssue] ?? 'يلزم مراجعة حالة الحجز.' : 'جارٍ التحقق؛ لا يدخل المبلغ في تمويل الحملة بعد.'}
                  </p>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {p.authorizationRecoverable && <RefundVerificationAction pledgeId={p.id} kind="authorization" />}
                    {p.authorizationRecoverable && p.authorizationIssue === 'authorization-terms-changed' &&
                      <RefundVerificationAction pledgeId={p.id} kind="release" />}
                    {pendingHeld(p) && <RefundVerificationAction pledgeId={p.id} kind="held" />}
                    {p.status === 'CAPTURE_GRACE' && p.authorizationIssue?.startsWith('payment:AUTHORIZE:') &&
                      <RefundVerificationAction pledgeId={p.id} kind="replacement" />}

                    {p.status === 'PENDING_AUTH' && ['void-awaiting-confirmation', 'void-outcome-unknown', 'void-not-confirmed'].includes(p.authorizationIssue ?? '') && <RefundVerificationAction pledgeId={p.id} kind="void" />}
                    {p.status === 'CAPTURED' && p.refundRequestedAt && BigInt(p.refundReservedHalalas ?? '0') > 0n && <RefundVerificationAction pledgeId={p.id} />}
                    {['HELD', 'PENDING_REAUTH', 'CAPTURED'].includes(p.status) && !p.refundRequestedAt && !pendingHeld(p) && (
                      <OpRunner
                        opKey="money.refund.pledge"
                        input={{ pledgeId: p.id }}
                        triggerLabel="استرداد"
                        riskTier="MONEY"
                        requiresReason
                        variant="danger"
                      />
                    )}
                    {p.status === 'FAILED_CAPTURE' && (
                      <OpRunner
                        opKey="money.pledge.revive"
                        input={{ pledgeId: p.id }}
                        triggerLabel="إحياء"
                        riskTier="MONEY"
                        requiresReason
                      />
                    )}
                    {p.status === 'DISPUTED' && (
                      <>
                        <OpRunner
                          opKey="money.dispute.resolve"
                          input={{ pledgeId: p.id, outcome: 'WON' }}
                          triggerLabel="حسم: لصالحنا"
                          riskTier="MONEY"
                          requiresReason
                        />
                        <OpRunner
                          opKey="money.dispute.resolve"
                          input={{ pledgeId: p.id, outcome: 'LOST' }}
                          triggerLabel="حسم: ضدّنا"
                          riskTier="MONEY"
                          requiresReason
                          variant="danger"
                        />
                      </>
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
          href={`/ops/money${qs({ tab: 'refunds', status, projectId, cursor: nextCursor })}`}
          className="inline-block text-sm text-[#58a6ff] hover:underline"
        >
          الأقدم ↓
        </Link>
      )}
    </section>
  );
}
