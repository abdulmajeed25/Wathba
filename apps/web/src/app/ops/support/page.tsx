import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { FilterForm } from '../_lib/filters';
import { StatTile } from '../_components/stat-tile';
import { TicketsTable, type TicketRow } from './tickets-table';

/**
 * OPS Phase 2 + OPS-360 Unit 3 — «الدعم» ticketing inbox. Server-first list
 * with a FilterForm (status / assignee / free text). Unit 3 draws the per-status
 * volume tiles from GET /v1/ops/tickets/stats (cross-page, not the old ≤50
 * page-local count) and resolves assignee UUIDs via <ActorName>. Every governed
 * action (assign / status / note / reply) lives on the ticket detail page.
 * Emails arrive masked from the API.
 */

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
}

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const STATUS_AR: Record<string, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد المعالجة',
  RESOLVED: 'محلولة',
  CLOSED: 'مغلقة',
};

export default async function OpsSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const filters = { status: sp.status, assignedToId: sp.assignedToId, q: sp.q };
  const headers = { 'x-ops-token': opsToken };

  let rows: TicketRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  let stats: { statusCounts: Record<string, number>; total: number } | null = null;

  try {
    const [r, statsRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/tickets${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/v1/ops/tickets/stats`, { headers, cache: 'no-store' }),
    ]);
    if (r.status === 403) refused = true;
    if (r.ok) {
      const body = (await r.json()) as { items: TicketRow[]; nextCursor: string | null };
      rows = body.items;
      nextCursor = body.nextCursor;
    }
    if (statsRes.ok) {
      stats = (await statsRes.json()) as { statusCounts: Record<string, number>; total: number };
    }
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  const counts = STATUSES.map((s) => ({
    status: s,
    count: stats?.statusCounts[s] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الدعم</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            تذاكر «اتصل بنا» — الإسناد وتغيير الحالة والملاحظات الداخلية والرد على صاحب التذكرة
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {counts.map((c) => (
          <StatTile
            key={c.status}
            label={STATUS_AR[c.status] ?? c.status}
            value={c.count.toLocaleString('ar-SA-u-nu-latn')}
            intent={c.status === 'OPEN' && c.count > 0 ? 'warn' : 'default'}
          />
        ))}
      </div>
      <p className="text-[11px] text-[#484f58]">
        الأعداد إجمالية عبر كل الصفحات (GET /v1/ops/tickets/stats)
        {stats ? ` — الإجمالي ${stats.total.toLocaleString('ar-SA-u-nu-latn')} تذكرة` : ''}.
      </p>

      <FilterForm
        fields={[
          {
            kind: 'select',
            name: 'status',
            labelAr: 'الحالة',
            allLabelAr: 'كل الحالات',
            options: STATUSES.map((s) => ({ value: s, labelAr: STATUS_AR[s] ?? s })),
          },
          {
            kind: 'text',
            name: 'assignedToId',
            labelAr: 'مُعرّف المُسنَد إليه',
            placeholderAr: 'مُعرّف المُسنَد إليه',
          },
          {
            kind: 'text',
            name: 'q',
            labelAr: 'بحث حر',
            placeholderAr: 'بحث (الاسم/البريد/الموضوع)',
          },
        ]}
        values={sp}
        action="/ops/support"
      />

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية support.tickets — صندوق الدعم للدعم أو مدير العمليات.
        </p>
      ) : (
        <TicketsTable rows={rows} />
      )}

      {nextCursor ? (
        <div className="text-center">
          <Link
            href={`/ops/support${qs({ ...filters, cursor: nextCursor })}`}
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            الأقدم ↓
          </Link>
        </div>
      ) : null}
    </div>
  );
}
