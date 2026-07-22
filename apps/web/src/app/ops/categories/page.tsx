import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { CategoriesEditor } from './_components/categories-editor';
import { buildCatTree, type CatApiNode, type CatNode } from './_components/cat-types';

/**
 * OPS Part 5 (CONTENT) — «الفئات»: the two-level taxonomy tree editor.
 *
 * OPS-GAPS Y1 — the tree is now read from the OPS read API
 * `GET /v1/ops/categories` (x-ops-token, content.categories), NOT the public
 * `GET /v1/categories`. The public reader returns ACTIVE nodes only, so an
 * operator who deactivated a category could never list it to reactivate it.
 * The ops read surfaces hidden nodes too — each carrying isActive + an
 * `excluded` flag — so this screen can show «غير مُفعَّلة» nodes with a
 * reactivate affordance, and lock permanently-excluded ones («مستثناة»).
 *
 * Every edit remains a governed CONTENT-tier operation (content.categories.*)
 * fired through <OpRunner>. The exclusions guard (BUG-2 + Y1) refuses
 * server-side; its Arabic message surfaces as an OpRunner blocker.
 */
export default async function OpsCategoriesPage() {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();

  let tree: CatNode[] = [];
  let unreachable = false;
  let refused = false;
  try {
    const r = await fetch(`${API_BASE}/v1/ops/categories`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.status === 403) refused = true;
    else if (r.ok) {
      const body = (await r.json()) as { items: CatApiNode[] };
      tree = buildCatTree(body.items ?? []);
    } else unreachable = true;
  } catch {
    unreachable = true;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الفئات</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            شجرة التصنيف من مستويين — الوجهة الوحيدة التي تتعلّق بها المشاريع. تشمل القائمة الفئات
            المخفاة (غير المُفعَّلة) لإتاحة إعادة تفعيلها. كل تعديل عملية محكومة ومسجَّلة في التدقيق.
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

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية إدارة الفئات (content.categories) — اطلبها من المالك.
        </p>
      ) : null}

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
