import Link from 'next/link';

import { API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { OpRunner } from '../_components/op-runner';

interface MilestoneRow {
  id: string;
  projectId: string;
  projectTitleAr?: string | null;
  order: number;
  titleAr: string;
  status: string;
  releasePct: number;
  evidenceUrl?: string | null;
  submittedAt?: string | null;
}

/**
 * OPS-360 Unit 3 — «المعالم»: the cross-project SUBMITTED-milestone queue.
 * Previously a count + redirect (no list endpoint existed). Now backed by
 * GET /ops/money/milestones?status=SUBMITTED — the operator reviews each
 * submitted milestone with its transparency evidence inline and runs the
 * governed money.milestone.approve / milestones.evidence.reject ops right
 * here. Release (money.milestone.release) follows approval.
 */
export async function MilestonesPanel({ opsToken, status }: { opsToken: string; status?: string }) {
  const st = status ?? 'SUBMITTED';
  let rows: MilestoneRow[] = [];
  let refused = false;
  try {
    const res = await fetch(`${API_BASE}/v1/ops/money/milestones${qs({ status: st, limit: '100' })}`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const b = (await res.json()) as { items: MilestoneRow[] };
      rows = b.items;
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض المعالم.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="milestones" />
          <select
            name="status"
            defaultValue={st}
            className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3]"
          >
            <option value="SUBMITTED">مُقدَّمة للمراجعة</option>
            <option value="APPROVED">معتمدة (بانتظار الصرف)</option>
          </select>
          <button className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]">
            تصفية
          </button>
        </form>
        <p className="text-xs text-[#8b949e]">
          اعتماد المعلم يمرّ بالتأكيد المالي؛ الصرف يُنشئ دفعة معلّقة تُصرف من تبويب «الدفعات».
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">المشروع</th>
              <th className="px-3 py-2 font-medium">المعلم</th>
              <th className="px-3 py-2 font-medium">النسبة</th>
              <th className="px-3 py-2 font-medium">الدليل</th>
              <th className="px-3 py-2 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#8b949e]">
                  لا معالم في هذه الحالة.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2">
                  <Link href={`/ops/projects/${m.projectId}`} className="text-[#58a6ff] hover:underline">
                    {m.projectTitleAr ?? `${m.projectId.slice(0, 8)}…`}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className="text-[#8b949e]">#{m.order}</span> {m.titleAr}
                </td>
                <td className="px-3 py-2 tabular-nums">{m.releasePct}٪</td>
                <td className="px-3 py-2">
                  {m.evidenceUrl ? (
                    <a href={m.evidenceUrl} target="_blank" rel="noreferrer" className="text-[#58a6ff] hover:underline" dir="ltr">
                      عرض الدليل ↗
                    </a>
                  ) : (
                    <span className="text-[#484f58]">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {m.status === 'SUBMITTED' && (
                      <>
                        <OpRunner
                          opKey="money.milestone.approve"
                          input={{ projectId: m.projectId, milestoneId: m.id }}
                          triggerLabel="اعتماد"
                          riskTier="MONEY"
                          requiresReason
                        />
                        <OpRunner
                          opKey="milestones.evidence.reject"
                          input={{ projectId: m.projectId, milestoneId: m.id }}
                          triggerLabel="رفض الدليل"
                          riskTier="STANDARD"
                          requiresReason
                          variant="danger"
                        />
                      </>
                    )}
                    {m.status === 'APPROVED' && (
                      <OpRunner
                        opKey="money.milestone.release"
                        input={{ projectId: m.projectId, milestoneId: m.id }}
                        triggerLabel="صرف"
                        riskTier="MONEY"
                        requiresReason
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
