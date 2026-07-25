import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { CollectionsManager, type Collection } from './_components/collections-manager';

/**
 * OPS Part 5 (CONTENT) — «المجموعات وحملات وثبة»: curated project collections.
 *
 * CLOSEOUT C3 — the read now comes from the OPS read layer
 * (`/v1/ops/collections`, ops token + `content.collections`) instead of the
 * legacy `/v1/admin/collections` JWT seam. That seam was the split-brain the
 * OPS-360 census flagged: two authorisation paths into the same data, only one
 * of which is the ops token the rest of the console uses. It lists ALL
 * collections (incl. inactive) WITH ids + project counts, which the public
 * `/v1/collections` reader omits. Every mutation was already a governed
 * CONTENT-tier operation (content.collections.*).
 *
 * NOTE — the admin list returns a project COUNT per collection, not the list
 * of assigned projects; assign/unassign therefore take a project id directly.
 * Surfacing the assigned-projects list needs a per-collection read endpoint
 * (follow-up gap).
 */
export default async function OpsCollectionsPage() {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();

  let collections: Collection[] = [];
  let refused = false;
  try {
    const r = await fetch(`${API_BASE}/v1/ops/collections`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.status === 403) refused = true;
    if (r.ok) collections = ((await r.json()) as { items: Collection[] }).items ?? [];
  } catch {
    /* API unreachable — the create surface still works below */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">المجموعات وحملات وثبة</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            تشكيلات مُنسَّقة من المشاريع تظهر في القائمة والرئيسية. كل تغيير عملية محكومة ومسجَّلة في
            التدقيق.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/ops/audit?q=content.collections" className="text-sm text-[#58a6ff] hover:underline">
            سجل التغييرات
          </Link>
          <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
            ← العودة للمركز
          </Link>
        </div>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية قراءة المجموعات (content.collections). يمكنك إنشاء حملة جديدة أدناه.
        </p>
      ) : null}

      <CollectionsManager collections={collections} />
    </div>
  );
}
