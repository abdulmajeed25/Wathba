import Link from 'next/link';

import { StatTile } from '../_components/stat-tile';
import { FilterForm, qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { ContestsTable } from './_components/contests-table';
import {
  CONTEST_STATUS_LABEL_AR,
  contestStatusLabel,
  type ContestRow,
} from './_components/contest-status';

/**
 * OPS-360 Unit 4 — «المسابقات»: cross-project contest OVERSIGHT. Server-first
 * (guard → ops-token fetch → 403 amber). Lists GET /v1/ops/contests with a
 * status filter and count tiles. Read-only: contests are creator-driven; no ops
 * exist yet (stated in the note below). If the endpoint 404s we degrade to an
 * amber "قيد الإنشاء" note.
 */

const STATUS_OPTIONS = Object.entries(CONTEST_STATUS_LABEL_AR).map(([value, labelAr]) => ({
  value,
  labelAr,
}));

export default async function OpsContestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const filters = { status: sp.status, projectId: sp.projectId };

  let rows: ContestRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  let missing = false;

  try {
    const res = await fetch(
      `${API_BASE}/v1/ops/contests${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`,
      { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
    );
    if (res.status === 403) refused = true;
    else if (res.status === 404) missing = true;
    else if (res.ok) {
      const body = (await res.json()) as
        | { items?: ContestRow[]; nextCursor?: string | null }
        | ContestRow[];
      if (Array.isArray(body)) rows = body;
      else {
        rows = body.items ?? [];
        nextCursor = body.nextCursor ?? null;
      }
    }
  } catch {
    /* API unreachable — empty/refused states render below */
  }

  // Count tiles per status — derived from the current page (advisory only).
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const tileStatuses = Object.keys(byStatus).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">المسابقات</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            رقابة المسابقات عبر المشاريع — عرض الحالة وعدد المشاركات والفائزين. للقراءة فقط (المسابقات
            يديرها أصحاب المشاريع، ولا عمليات عليها بعد).
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية عرض المسابقات — اطلبها من المالك.
        </p>
      ) : null}

      {missing ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          قيد الإنشاء — نقطة GET /v1/ops/contests لم تُنشر بعد.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="مسابقات (هذه الصفحة)" value={rows.length.toLocaleString('ar-SA')} />
          {tileStatuses.map((s) => (
            <StatTile
              key={s}
              label={contestStatusLabel(s)}
              value={(byStatus[s] ?? 0).toLocaleString('ar-SA')}
              href={`/ops/contests${qs({ status: s })}`}
            />
          ))}
        </div>
      ) : null}

      <FilterForm
        fields={[
          {
            kind: 'select',
            name: 'status',
            labelAr: 'الحالة',
            allLabelAr: 'كل الحالات',
            options: STATUS_OPTIONS,
          },
          { kind: 'text', name: 'projectId', placeholderAr: 'معرّف المشروع', labelAr: 'المشروع' },
        ]}
        values={sp}
      />

      {!missing ? <ContestsTable rows={rows} /> : null}

      {nextCursor ? (
        <div className="text-center">
          <Link
            href={`/ops/contests${qs({ ...filters, cursor: nextCursor })}`}
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            الأقدم ↓
          </Link>
        </div>
      ) : null}
    </div>
  );
}
