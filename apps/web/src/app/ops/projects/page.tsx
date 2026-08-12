import Link from 'next/link';

import { StatTile } from '../_components/stat-tile';
import { FilterForm, qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { ProjectsTable } from './_components/projects-table';
import { STATUS_LABEL_AR, statusLabel, type ProjectRow } from './_components/status';

/**
 * OPS Phase 2 — «المشاريع»: the projects list. Server-first (guard →
 * ops-token fetch → 403 banner). Filters are the shared GET <FilterForm>;
 * the table + bulk actions are a client island (column renderers + multi-
 * select must run client-side). Cursor pagination is a plain link.
 *
 * OPS-360 Unit 3 — cross-page status tiles from GET /v1/ops/projects/stats
 * (never derived from the current page), plus the DataTable power features
 * (tableKey + savedViews + CSV + sortable) and the governed <BulkBar> now live
 * inside <ProjectsTable>, and the sortable openReportCount column linking to
 * trust.
 */

const STATUS_OPTIONS = Object.entries(STATUS_LABEL_AR).map(([value, labelAr]) => ({ value, labelAr }));

interface ProjectStats {
  statusCounts: Record<string, number>;
  total: number;
}

/** The status tiles worth surfacing at a glance (the operational cohorts). */
const TILE_STATUSES: Array<{ key: string; intent: 'default' | 'warn' | 'ok' }> = [
  { key: 'UNDER_REVIEW', intent: 'warn' },
  { key: 'LIVE', intent: 'ok' },
  { key: 'PAUSED', intent: 'warn' },
  { key: 'SUCCESSFUL', intent: 'ok' },
];

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
  let stats: ProjectStats | null = null;

  try {
    const [res, statsRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/projects${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/v1/ops/projects/stats${qs({ categoryId: filters.categoryId })}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
    ]);
    if (res.status === 403) refused = true;
    if (res.ok) {
      const body = (await res.json()) as { items: ProjectRow[]; nextCursor: string | null };
      rows = body.items;
      nextCursor = body.nextCursor;
    }
    if (statsRes.ok) stats = (await statsRes.json()) as ProjectStats;
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

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="إجمالي المشاريع" value={stats.total.toLocaleString('ar-SA-u-nu-latn')} />
          {TILE_STATUSES.map((t) => (
            <StatTile
              key={t.key}
              label={statusLabel(t.key)}
              value={(stats!.statusCounts[t.key] ?? 0).toLocaleString('ar-SA-u-nu-latn')}
              intent={(stats!.statusCounts[t.key] ?? 0) > 0 ? t.intent : 'default'}
              href={`/ops/projects${qs({ status: t.key })}`}
            />
          ))}
        </div>
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
