import Link from 'next/link';

import { StatTile } from '../_components/stat-tile';
import { FilterForm, qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { AppealsTable, type AppealRow } from './appeals-table';
import { appealStatusLabel } from './status';

/**
 * OPS-GAPS R1 — «التظلّمات»: the moderation appeals queue. Server-first
 * (guard → x-ops-token fetch → 403 amber banner). Reads GET /v1/ops/appeals
 * (moderation.queue). Status + kind filters ride the URL; the table itself is
 * the shared DataTable island with tableKey/savedViews/csv. The SLA age +
 * OVERDUE flag are surfaced per row, and the open/overdue tallies are lifted to
 * stat tiles at the top so an operator triages by breach first.
 *
 * Degrades to an amber «قيد الإنشاء» note when the endpoint 404s (the backend
 * contract is built in parallel) — never fabricates rows.
 */

const KIND_OPTIONS = [
  { value: 'ACCOUNT_BAN', labelAr: 'حظر حساب' },
  { value: 'PROJECT_REJECTION', labelAr: 'رفض مشروع' },
  // CLOSEOUT C4 — a hidden comment is appealable too.
  { value: 'CONTENT_TAKEDOWN', labelAr: 'إخفاء تعليق' },
];

const STATUS_OPTIONS = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'UPHELD',
  'OVERTURNED',
  'PARTIALLY_GRANTED',
].map((value) => ({ value, labelAr: appealStatusLabel(value) }));

export default async function OpsAppealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const filters = { status: sp.status, kind: sp.kind };

  let rows: AppealRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  let pending = false; // endpoint 404 → "قيد الإنشاء"

  try {
    const res = await fetch(
      `${API_BASE}/v1/ops/appeals${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`,
      { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
    );
    if (res.status === 403) refused = true;
    else if (res.status === 404) pending = true;
    else if (res.ok) {
      const body = (await res.json()) as { items: AppealRow[]; nextCursor?: string | null };
      rows = body.items ?? [];
      nextCursor = body.nextCursor ?? null;
    }
  } catch {
    /* API unreachable — the empty/pending states render below */
  }

  const openCount = rows.filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length;
  const overdueCount = rows.filter((r) => r.overdue).length;
  const banCount = rows.filter((r) => r.kind === 'ACCOUNT_BAN').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">التظلّمات</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            مراجعة تظلّمات حظر الحسابات ورفض المشاريع — كل قرار عملية محكومة (بمبدأ الأربع أعين:
            لا يُراجع القرارَ صاحبُه) ومدوَّنة في التدقيق. تجاوز مهلة الخدمة (SLA) يُعلَّم بالأحمر.
          </p>
        </div>
        <Link href="/ops/trust" className="text-sm text-[#58a6ff] hover:underline">
          ← الثقة والأمان
        </Link>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية الإشراف (moderation.queue) — اطلبها من المالك.
        </p>
      ) : null}

      {pending ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          خدمة التظلّمات قيد الإنشاء — لم يُفعَّل مسار «GET /v1/ops/appeals» بعد على الخادم.
        </p>
      ) : null}

      {!refused && !pending ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="تظلّمات مفتوحة (بهذه الصفحة)"
            value={openCount.toLocaleString('ar-SA-u-nu-latn')}
            intent={openCount > 0 ? 'warn' : 'default'}
          />
          <StatTile
            label="تجاوزت SLA"
            value={overdueCount.toLocaleString('ar-SA-u-nu-latn')}
            intent={overdueCount > 0 ? 'warn' : 'default'}
          />
          <StatTile label="تظلّمات حظر" value={banCount.toLocaleString('ar-SA-u-nu-latn')} />
        </section>
      ) : null}

      {!refused && !pending ? (
        <>
          <FilterForm
            fields={[
              {
                kind: 'select',
                name: 'kind',
                labelAr: 'النوع',
                allLabelAr: 'كل الأنواع',
                options: KIND_OPTIONS,
              },
              {
                kind: 'select',
                name: 'status',
                labelAr: 'الحالة',
                allLabelAr: 'كل الحالات',
                options: STATUS_OPTIONS,
              },
            ]}
            values={sp}
          />

          <AppealsTable rows={rows} />

          {nextCursor ? (
            <div className="text-center">
              <Link
                href={`/ops/appeals${qs({ ...filters, cursor: nextCursor })}`}
                className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
              >
                الأقدم ↓
              </Link>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
