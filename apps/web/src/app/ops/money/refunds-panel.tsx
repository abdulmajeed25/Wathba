import Link from 'next/link';

import { API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { formatSar } from '../_lib/money';
import { StatusBadge } from '../_components/badge';
import { OpRunner } from '../_components/op-runner';

interface PledgeRow {
  id: string;
  projectId: string;
  backerEmail?: string | null;
  amountHalalas: string;
  addOnsHalalas: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
}

const STATUS_INTENT: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'muted'> = {
  CAPTURED: 'ok',
  HELD: 'info',
  CAPTURE_GRACE: 'warn',
  FAILED_CAPTURE: 'danger',
  REFUNDED: 'muted',
  DISPUTED: 'danger',
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
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض التعهدات.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value="refunds" />
          <input
            name="projectId"
            defaultValue={projectId ?? ''}
            placeholder="مُعرّف المشروع"
            className="w-56 rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
            dir="ltr"
          />
          <select
            name="status"
            defaultValue={status ?? ''}
            className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
          >
            <option value="">كل الحالات</option>
            <option value="HELD">محجوزة</option>
            <option value="CAPTURED">مقطوفة</option>
            <option value="CAPTURE_GRACE">مهلة التقاط</option>
            <option value="FAILED_CAPTURE">التقاط فاشل</option>
            <option value="DISPUTED">متنازَع عليها</option>
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
        <table className="w-full min-w-[900px] text-sm">
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
                  {p.backerEmail ?? '—'}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatSar(p.amountHalalas)}</td>
                <td className="px-3 py-2">{p.paymentMethod}</td>
                <td className="px-3 py-2">
                  <StatusBadge intent={STATUS_INTENT[p.status] ?? 'muted'}>{p.status}</StatusBadge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {['HELD', 'PENDING_REAUTH', 'CAPTURED'].includes(p.status) && (
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
