import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { CollectionsManager, type Collection } from './_components/collections-manager';

/**
 * OPS Part 5 (CONTENT) — «المجموعات وحملات وثبة»: curated project collections.
 *
 * Read from the ADMIN GET seam (`/v1/admin/collections`) — it lists ALL
 * collections (incl. inactive) WITH their ids + project counts, which the
 * public `/v1/collections` reader omits (it returns neither ids nor inactive
 * rows, so it can't drive update/delete/assign). The seam is `@Roles('ADMIN')`,
 * which the operator holds; we authorize with the session bearer. Every
 * mutation is a governed CONTENT-tier operation (content.collections.*).
 *
 * NOTE — the admin list returns a project COUNT per collection, not the list
 * of assigned projects; assign/unassign therefore take a project id directly.
 * Surfacing the assigned-projects list needs a per-collection read endpoint
 * (follow-up gap).
 */
export default async function OpsCollectionsPage() {
  const { token } = await requireAdmin();
  await requireOpsSession();

  let collections: Collection[] = [];
  let refused = false;
  try {
    const r = await fetch(`${API_BASE}/v1/admin/collections`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (r.status === 403) refused = true;
    if (r.ok) collections = (await r.json()) as Collection[];
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
          تفتقد صلاحية قراءة المجموعات — تحتاج دور ADMIN. يمكنك إنشاء حملة جديدة أدناه.
        </p>
      ) : null}

      <CollectionsManager collections={collections} />
    </div>
  );
}
