import Link from 'next/link';

import { API_BASE } from '../_lib/guard';

/**
 * «المعالم» — milestone approvals with the transparency evidence attached.
 * There is no cross-project "submitted milestones" list endpoint yet (the
 * milestone ops anchor per project), so the vault surfaces the pending count
 * and routes the operator to each project's workspace where the milestone +
 * its evidence live. The three governed ops (approve/release/reject) run from
 * there via <OpRunner>. Honest: no fabricated cross-project queue.
 */
export async function MilestonesPanel({ opsToken }: { opsToken: string }) {
  let submitted = 0;
  let refused = false;
  try {
    const res = await fetch(`${API_BASE}/v1/ops/dashboard`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const d = (await res.json()) as { workQueue?: { milestonesSubmitted?: number } };
      submitted = d.workQueue?.milestonesSubmitted ?? 0;
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية عرض المعالم.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#8b949e]">معالم بانتظار الاعتماد</p>
            <p className="text-2xl font-bold text-[#e6edf3] tabular-nums">{submitted}</p>
          </div>
          <Link
            href="/ops/projects?status=IN_PRODUCTION"
            className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]"
          >
            المشاريع قيد الإنتاج ←
          </Link>
        </div>
      </div>
      <p className="text-sm text-[#8b949e] leading-relaxed">
        اعتماد المعالم وصرفها يتم من مساحة عمل كل مشروع (تبويب «المعالم والدفعات»)، حيث تُعرض أدلّة الشفافية المرفقة بجانب كل معلم.
        العمليات المحكومة المتاحة هناك: <code dir="ltr">money.milestone.approve</code> ثم <code dir="ltr">money.milestone.release</code> (تنشئ دفعة معلّقة)،
        و<code dir="ltr">milestones.evidence.reject</code> لإعادة المعلم للمُنشئ مع ملاحظات. كلها من الفئة المالية/الحسّاسة وتمرّ بالتأكيد الثنائي والسبب المكتوب.
      </p>
    </section>
  );
}
