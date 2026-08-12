import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { ReviewCard } from '../projects/_components/review-card';
import type { ProjectRow } from '../projects/_components/status';

/**
 * OPS Phase 2 — «طابور المراجعة»: the review WORKSPACE. Fetches every
 * UNDER_REVIEW project and renders a governed review card per project
 * (checklist + canned Arabic feedback + approve/reject/request-changes).
 * Server-first; the cards are the only client islands.
 */

export default async function OpsReviewPage() {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();

  let rows: ProjectRow[] = [];
  let refused = false;

  try {
    const res = await fetch(`${API_BASE}/v1/ops/projects?status=UNDER_REVIEW&limit=50`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (res.status === 403) refused = true;
    if (res.ok) rows = ((await res.json()) as { items: ProjectRow[] }).items;
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">طابور المراجعة</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            المشاريع في حالة UNDER_REVIEW — افحص القائمة، ثم اعتمد أو ارفض أو اطلب تعديلاً. كل قرار
            عملية محكومة تُسجَّل في التدقيق وتُخطر المبدع.
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-2.5 text-xs text-[#8b949e]">
        تنبيه: إسناد المراجعين خارج النطاق حالياً (لا نقطة نهاية للحجز/الإسناد) — البطاقات مشتركة بين
        كل المراجعين، فنسّقوا يدوياً لتفادي المراجعة المزدوجة.
      </p>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية projects.review — اطلب دور REVIEWER أو أعلى من المالك.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-6 text-center text-sm text-emerald-300">
          ✓ الطابور فارغ — لا مشاريع بانتظار المراجعة.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[#8b949e]">
            {rows.length.toLocaleString('ar-SA-u-nu-latn')} مشروع بانتظار المراجعة
          </p>
          {rows.map((p) => (
            <ReviewCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
