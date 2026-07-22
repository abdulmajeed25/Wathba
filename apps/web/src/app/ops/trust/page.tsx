import Link from 'next/link';

import { StatTile } from '../_components/stat-tile';
import { FilterForm, qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { ModerationQueue, type TrustProjectRow } from './moderation-queue';

/**
 * OPS Phase 2 — «الثقة والسلامة»: the unified moderation surface. Server-first.
 *
 * There is no dedicated reports-list endpoint yet, so the queue is assembled
 * from what exists: /dashboard supplies the open-report COUNTS (project +
 * comment), and /projects (with a hidden filter) supplies the actual rows the
 * operator acts on. Per-project openReportCount is only exposed on the project
 * DETAIL endpoint, so the list cannot yet be filtered to "reported only" —
 * a dedicated /ops/reports queue (and a repeat-offender view) is a documented
 * FOLLOW-UP. Moderation itself runs through governed OpRunners in the island.
 *
 * Permission: the dashboard needs any ops role; the moderation ops are gated
 * server-side per key. 403 on either read → amber banner.
 */

interface DashboardCounts {
  workQueue: {
    reportsOpen: number;
    projectReportsOpen: number;
    commentReportsOpen: number;
  };
}

export default async function OpsTrustPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  // Default the queue to moderated (hidden) projects — the actionable set.
  const hidden = sp.hidden ?? 'true';
  const filters = { hidden, status: sp.status, q: sp.q };

  let counts: DashboardCounts['workQueue'] | null = null;
  let projects: TrustProjectRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;

  try {
    const [dashRes, projRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/dashboard`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(
        `${API_BASE}/v1/ops/projects${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`,
        { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
      ),
    ]);
    if (dashRes.status === 403 || projRes.status === 403) refused = true;
    if (dashRes.ok) counts = ((await dashRes.json()) as DashboardCounts).workQueue;
    if (projRes.ok) {
      const body = (await projRes.json()) as { items: TrustProjectRow[]; nextCursor: string | null };
      projects = body.items;
      nextCursor = body.nextCursor;
    }
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الثقة والسلامة</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            طابور الإشراف الموحّد — البلاغات على المشاريع والتعليقات، وإجراءات الحظر والإخفاء. كل
            إجراء عملية محكومة ومدوَّنة.
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية الإشراف (moderation.queue) — اطلبها من المالك.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="إجمالي البلاغات المفتوحة"
          value={(counts?.reportsOpen ?? 0).toLocaleString('ar-SA')}
          intent={counts && counts.reportsOpen > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="بلاغات على المشاريع"
          value={(counts?.projectReportsOpen ?? 0).toLocaleString('ar-SA')}
          intent={counts && counts.projectReportsOpen > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="بلاغات على التعليقات"
          value={(counts?.commentReportsOpen ?? 0).toLocaleString('ar-SA')}
          intent={counts && counts.commentReportsOpen > 0 ? 'warn' : 'default'}
        />
      </section>

      <p className="rounded border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-200">
        ملاحظة: لا توجد بعد نقطة نهاية مخصّصة لقائمة البلاغات الموحّدة أو عرض «المُخالِف المتكرّر».
        عدّاد البلاغات لكل مشروع متاح على صفحة تفاصيل المشروع فقط، لذا يعرض هذا الطابور المشاريع
        المُخفاة (المُشرَف عليها) افتراضياً — وهذا متروك كعمل لاحق.
      </p>

      <FilterForm
        fields={[
          {
            kind: 'select',
            name: 'hidden',
            labelAr: 'الرؤية',
            allLabelAr: 'الكل',
            options: [
              { value: 'true', labelAr: 'المخفية (مُشرَف عليها)' },
              { value: 'false', labelAr: 'الظاهرة' },
            ],
          },
          { kind: 'text', name: 'q', placeholderAr: 'عنوان المشروع' },
        ]}
        values={{ ...sp, hidden }}
      />

      <ModerationQueue projects={projects} />

      {nextCursor ? (
        <div className="text-center">
          <Link
            href={`/ops/trust${qs({ ...filters, cursor: nextCursor })}`}
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            التالي ↓
          </Link>
        </div>
      ) : null}
    </div>
  );
}
