import Link from 'next/link';

import { FilterForm, qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { ProjectsTable } from './_components/projects-table';
import { STATUS_LABEL_AR, type ProjectRow } from './_components/status';

/**
 * OPS Phase 2 — «المشاريع»: the projects list. Server-first (guard →
 * ops-token fetch → 403 banner). Filters are the shared GET <FilterForm>;
 * the table + bulk actions are a client island (column renderers + multi-
 * select must run client-side). Cursor pagination is a plain link.
 */

const STATUS_OPTIONS = Object.entries(STATUS_LABEL_AR).map(([value, labelAr]) => ({ value, labelAr }));

export default async function OpsProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const filters = {
    status: sp.status,
    categoryId: sp.categoryId,
    q: sp.q,
    hidden: sp.hidden,
  };

  let rows: ProjectRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;

  try {
    const res = await fetch(
      `${API_BASE}/v1/ops/projects${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`,
      { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
    );
    if (res.status === 403) refused = true;
    if (res.ok) {
      const body = (await res.json()) as { items: ProjectRow[]; nextCursor: string | null };
      rows = body.items;
      nextCursor = body.nextCursor;
    }
  } catch {
    /* API unreachable — the empty/refused states render below */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">المشاريع</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            الاعتماد والرفض ودورة الحياة والتمييز والإخفاء — كل إجراء عملية محكومة، والأرقام مشتقة من
            دفتر التعهدات
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية projects.review — اطلب دور REVIEWER أو أعلى من المالك.
        </p>
      ) : null}

      <FilterForm
        fields={[
          { kind: 'text', name: 'q', placeholderAr: 'بحث في العنوان', labelAr: 'بحث' },
          {
            kind: 'select',
            name: 'status',
            labelAr: 'الحالة',
            allLabelAr: 'كل الحالات',
            options: STATUS_OPTIONS,
          },
          { kind: 'text', name: 'categoryId', placeholderAr: 'معرّف الفئة', labelAr: 'الفئة' },
          {
            kind: 'select',
            name: 'hidden',
            labelAr: 'الظهور',
            allLabelAr: 'الكل (ظاهر ومخفي)',
            options: [
              { value: 'true', labelAr: 'المخفية فقط' },
              { value: 'false', labelAr: 'الظاهرة فقط' },
            ],
          },
        ]}
        values={sp}
      />

      <ProjectsTable rows={rows} />

      {nextCursor ? (
        <div className="text-center">
          <Link
            href={`/ops/projects${qs({ ...filters, cursor: nextCursor })}`}
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            الأقدم ↓
          </Link>
        </div>
      ) : null}
    </div>
  );
}
