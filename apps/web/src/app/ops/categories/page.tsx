import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { CategoriesEditor, type CatNode } from './_components/categories-editor';

/**
 * OPS Part 5 (CONTENT) — «الفئات»: the two-level taxonomy tree editor.
 *
 * The active tree (with LIVE project counts) is read from the PUBLIC
 * `GET /v1/categories` reader — categories are public data and the ops read
 * API doesn't cover them. Every edit is a governed CONTENT-tier operation
 * (content.categories.*), fired through <OpRunner>. The permanent cultural
 * exclusions guard (BUG-2) refuses server-side; its Arabic message surfaces
 * as an OpRunner blocker.
 *
 * NOTE — the public tree lists ACTIVE nodes only, so this screen deactivates
 * («إخفاء») but cannot list already-hidden nodes to re-activate. Re-activation
 * is available as an operation (content.categories.set-active {isActive:true})
 * but needs an admin "all categories" read endpoint to surface the hidden set
 * (follow-up gap).
 */
export default async function OpsCategoriesPage() {
  await requireAdmin();
  await requireOpsSession();

  let tree: CatNode[] = [];
  let unreachable = false;
  try {
    const r = await fetch(`${API_BASE}/v1/categories`, { cache: 'no-store' });
    if (r.ok) tree = (await r.json()) as CatNode[];
    else unreachable = true;
  } catch {
    unreachable = true;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الفئات</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            شجرة التصنيف من مستويين — الوجهة الوحيدة التي تتعلّق بها المشاريع. كل تعديل عملية محكومة
            ومسجَّلة في التدقيق.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/ops/audit?q=content.categories" className="text-sm text-[#58a6ff] hover:underline">
            سجل التغييرات
          </Link>
          <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
            ← العودة للمركز
          </Link>
        </div>
      </div>

      {unreachable ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تعذّر قراءة شجرة الفئات الآن — يمكنك مع ذلك إنشاء فئة جديدة أدناه، لكن القائمة الحالية غير
          متاحة.
        </p>
      ) : null}

      <CategoriesEditor tree={tree} />
    </div>
  );
}
