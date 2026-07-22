import Link from 'next/link';
import { notFound } from 'next/navigation';

import { API_BASE, requireAdmin, requireOpsSession } from '../../_lib/guard';
import { formatSar } from '../../_lib/money';
import { OpRunner } from '../../_components/op-runner';
import { StatusBadge, type StatusIntent } from '../../_components/badge';

/**
 * OPS Phase 2 — RFQ detail. Overview + the (masked-supplier) bids table with
 * per-bid shortlisting, an operations panel (rfq.close / rfq.cancel) and the
 * per-entity audit timeline. Every mutation is a governed <OpRunner>.
 */

interface Bid {
  id: string;
  supplier: { id: string; name: string; email: string; verified: boolean };
  amountHalalas: string | null;
  leadTimeDays: number | null;
  specComplianceNote: string | null;
  status: string;
  createdAt: string | null;
}
interface RfqDetail {
  id: string;
  projectId: string;
  projectTitleAr: string | null;
  specsAr: string | null;
  status: string;
  dueDate: string | null;
  awardedBidId: string | null;
  createdAt: string | null;
  bids: Bid[];
}
interface AuditRow {
  id: string;
  chainSeq: string;
  action: string;
  actorType: string;
  reason: string | null;
  createdAt: string;
}

const RFQ_INTENT: Record<string, StatusIntent> = {
  OPEN: 'info',
  AWARDED: 'ok',
  CLOSED: 'muted',
  CANCELLED: 'danger',
};
const BID_INTENT: Record<string, StatusIntent> = {
  SUBMITTED: 'info',
  SHORTLISTED: 'warn',
  AWARDED: 'ok',
  REJECTED: 'danger',
  WITHDRAWN: 'muted',
};

export default async function OpsRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const { id } = await params;

  let rfq: RfqDetail | null = null;
  let refused = false;
  let audit: AuditRow[] = [];

  try {
    const [rfqRes, auditRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/procurement/rfqs/${id}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/v1/ops/audit/entity/RFQ/${id}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
    ]);
    if (rfqRes.status === 403) refused = true;
    if (rfqRes.status === 404) notFound();
    if (rfqRes.ok) rfq = (await rfqRes.json()) as RfqDetail;
    if (auditRes.ok) audit = ((await auditRes.json()) as { items: AuditRow[] }).items;
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  if (refused) {
    return (
      <div className="space-y-4">
        <Link href="/ops/suppliers" className="text-sm text-[#58a6ff] hover:underline">
          ← الموردون والمزادات
        </Link>
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية projects.review لعرض تفاصيل طلب العروض.
        </p>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="space-y-4">
        <Link href="/ops/suppliers" className="text-sm text-[#58a6ff] hover:underline">
          ← الموردون والمزادات
        </Link>
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          تعذّر تحميل طلب العروض (الخادم غير متاح أو الطلب غير موجود).
        </p>
      </div>
    );
  }

  const isOpen = rfq.status === 'OPEN';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/ops/suppliers" className="text-sm text-[#58a6ff] hover:underline">
            ← الموردون والمزادات
          </Link>
          <h1 className="mt-1 text-lg font-bold">
            طلب عروض — {rfq.projectTitleAr ?? rfq.projectId}
          </h1>
        </div>
        <StatusBadge intent={RFQ_INTENT[rfq.status] ?? 'muted'}>{rfq.status}</StatusBadge>
      </div>

      {/* overview */}
      <dl className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-[#8b949e]">المشروع</dt>
          <dd className="mt-0.5">
            <Link href={`/ops/projects/${rfq.projectId}`} className="text-[#58a6ff] hover:underline">
              {rfq.projectTitleAr ?? rfq.projectId}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#8b949e]">آخر موعد للعروض</dt>
          <dd className="mt-0.5">
            {rfq.dueDate
              ? new Date(rfq.dueDate).toLocaleDateString('ar-SA', { dateStyle: 'medium' })
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#8b949e]">عدد العروض</dt>
          <dd className="mt-0.5 tabular-nums">{rfq.bids.length.toLocaleString('ar-SA')}</dd>
        </div>
        {rfq.specsAr ? (
          <div className="sm:col-span-3">
            <dt className="text-xs text-[#8b949e]">المواصفات</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm">{rfq.specsAr}</dd>
          </div>
        ) : null}
      </dl>

      {/* operations panel */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">العمليات</h2>
        <div className="flex flex-wrap gap-2 rounded-lg border border-[#21262d] bg-[#161b22] p-4">
          <OpRunner
            opKey="rfq.close"
            input={{ rfqId: rfq.id }}
            triggerLabel="إغلاق الطلب"
            riskTier="STANDARD"
            requiresReason={false}
            variant="ghost"
            disabled={!isOpen}
          />
          <OpRunner
            opKey="rfq.cancel"
            input={{ rfqId: rfq.id }}
            triggerLabel="إلغاء الطلب"
            riskTier="STANDARD"
            requiresReason
            variant="danger"
            disabled={!isOpen}
          />
          {!isOpen ? (
            <span className="self-center text-xs text-[#8b949e]">
              الطلب ليس مفتوحاً — لا إغلاق ولا إلغاء
            </span>
          ) : null}
        </div>
      </section>

      {/* bids */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">العروض (المورّد مقنَّع)</h2>
        <div className="overflow-x-auto rounded-lg border border-[#21262d]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[#161b22] text-right text-[#8b949e]">
              <tr>
                <th className="px-3 py-2 font-medium">المورّد</th>
                <th className="px-3 py-2 font-medium">المبلغ</th>
                <th className="px-3 py-2 font-medium">مدة التوريد</th>
                <th className="px-3 py-2 font-medium">الحالة</th>
                <th className="px-3 py-2 font-medium">ملاحظة المطابقة</th>
                <th className="px-3 py-2 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
              {rfq.bids.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[#8b949e]">
                    لا عروض بعد
                  </td>
                </tr>
              ) : (
                rfq.bids.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="px-3 py-2">
                      <span dir="ltr" className="text-[#8b949e]">
                        {b.supplier.email}
                      </span>
                      {b.supplier.verified ? (
                        <span className="mr-1 text-[11px] text-emerald-400">✓ موثَّق</span>
                      ) : (
                        <span className="mr-1 text-[11px] text-amber-400">غير موثَّق</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-bold tabular-nums">
                      {formatSar(b.amountHalalas)}
                    </td>
                    <td className="px-3 py-2 text-[#8b949e]">
                      {b.leadTimeDays !== null ? `${b.leadTimeDays.toLocaleString('ar-SA')} يوم` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge intent={BID_INTENT[b.status] ?? 'muted'}>{b.status}</StatusBadge>
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-xs text-[#8b949e]">
                      {b.specComplianceNote ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <OpRunner
                        opKey="bids.shortlist"
                        input={{ bidId: b.id }}
                        triggerLabel="ترشيح"
                        riskTier="STANDARD"
                        requiresReason={false}
                        variant="ghost"
                        disabled={b.status !== 'SUBMITTED'}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* audit timeline */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">سجل الطلب</h2>
        <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
          {audit.length === 0 ? (
            <p className="text-sm text-[#8b949e]">
              لا قيود تدقيق مرتبطة مباشرةً بهذا الطلب.
            </p>
          ) : (
            <ol className="space-y-2">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="tabular-nums text-[#484f58]">#{a.chainSeq}</span>
                  <span className="whitespace-nowrap text-[#8b949e]">
                    {new Date(a.createdAt).toLocaleString('ar-SA', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <code className="font-mono text-[#e6edf3]">{a.action}</code>
                  <span className="text-[#8b949e]">{a.actorType}</span>
                  {a.reason ? <span className="text-[#8b949e]">— {a.reason}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
