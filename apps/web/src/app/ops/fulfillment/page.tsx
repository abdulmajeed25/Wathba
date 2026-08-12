import Link from 'next/link';

import { StatTile } from '../_components/stat-tile';
import { FilterForm, qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { FulfillmentTable, type FulfillmentRow } from './_components/fulfillment-table';
import { rewardStatusLabel } from './status';

/**
 * OPS-360 Unit 4 — «تسليم المكافآت»: the cross-project reward-fulfillment
 * roster. Server-first (guard → ops-token fetch → 403 amber). Lists
 * GET /v1/ops/fulfillment?rewardStatus= with a status filter + count tiles.
 *
 * This closes the A7 "fulfillment has no ops surface" gap as an OBSERVABILITY
 * screen — read-only: delivery is creator bookkeeping, no ops override exists
 * yet (stated in the note). If the endpoint 404s we degrade to an amber note.
 */

const STATUS_FILTER = ['PENDING', 'IN_PROGRESS', 'SENT'] as const;
const STATUS_OPTIONS = STATUS_FILTER.map((value) => ({ value, labelAr: rewardStatusLabel(value) }));

function normaliseRow(raw: unknown): FulfillmentRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  const backer = (r.backer ?? {}) as Record<string, unknown>;
  const pledgeId = String(r.pledgeId ?? r.id ?? '');
  return {
    id: pledgeId,
    pledgeId,
    projectId: String(r.projectId ?? ''),
    projectTitleAr: (r.projectTitleAr as string) ?? null,
    backer: {
      id: String(backer.id ?? r.backerId ?? ''),
      name: (backer.name as string) ?? null,
      email: (backer.email as string) ?? null,
    },
    tierTitleAr: (r.tierTitleAr as string) ?? null,
    rewardStatus: String(r.rewardStatus ?? ''),
    backerNo: (r.backerNo as number) ?? null,
  };
}

export default async function OpsFulfillmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const rewardStatus = sp.rewardStatus;
  const opts = { headers: { 'x-ops-token': opsToken }, cache: 'no-store' as const };

  let rows: FulfillmentRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  let missing = false;

  try {
    const res = await fetch(
      `${API_BASE}/v1/ops/fulfillment${qs({ rewardStatus, cursor: sp.cursor, limit: '50' })}`,
      opts,
    );
    if (res.status === 403) refused = true;
    else if (res.status === 404) missing = true;
    else if (res.ok) {
      const body = (await res.json()) as
        | { items?: unknown[]; nextCursor?: string | null }
        | unknown[];
      const items = Array.isArray(body) ? body : (body.items ?? []);
      rows = items.map(normaliseRow);
      if (!Array.isArray(body)) nextCursor = body.nextCursor ?? null;
    }
  } catch {
    /* API unreachable — empty/refused states render below */
  }

  // Count tiles per status (advisory — derived from the current page).
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.rewardStatus] = (acc[r.rewardStatus] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">تسليم المكافآت</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            سِجل تسليم المكافآت عبر المشاريع — من المُنتظِر والمُجهَّز والمُرسَل. شاشة ملاحظة (التسليم
            دفتر يديره صاحب المشروع، ولا تجاوز إداري عليه بعد).
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية عرض تسليم المكافآت — اطلبها من المالك.
        </p>
      ) : null}

      {missing ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          قيد الإنشاء — نقطة GET /v1/ops/fulfillment لم تُنشر بعد.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="مكافآت (هذه الصفحة)" value={rows.length.toLocaleString('ar-SA-u-nu-latn')} />
          {STATUS_FILTER.map((s, i) => {
            const tone = (['default', 'warn', 'ok'] as const)[i] ?? 'default';
            return (
              <StatTile
                key={s}
                label={rewardStatusLabel(s)}
                value={(byStatus[s] ?? 0).toLocaleString('ar-SA-u-nu-latn')}
                intent={(byStatus[s] ?? 0) > 0 ? tone : 'default'}
                href={`/ops/fulfillment${qs({ rewardStatus: s })}`}
              />
            );
          })}
        </div>
      ) : null}

      <FilterForm
        fields={[
          {
            kind: 'select',
            name: 'rewardStatus',
            labelAr: 'حالة التسليم',
            allLabelAr: 'كل الحالات',
            options: STATUS_OPTIONS,
          },
        ]}
        values={sp}
      />

      {!missing ? <FulfillmentTable rows={rows} /> : null}

      {nextCursor ? (
        <div className="text-center">
          <Link
            href={`/ops/fulfillment${qs({ rewardStatus, cursor: nextCursor })}`}
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            الأقدم ↓
          </Link>
        </div>
      ) : null}
    </div>
  );
}
