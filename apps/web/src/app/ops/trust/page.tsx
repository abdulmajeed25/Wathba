import Link from 'next/link';

import { StatTile } from '../_components/stat-tile';
import { qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import {
  ModerationQueue,
  type TrustCommentRow,
  type TrustReportRow,
} from './moderation-queue';

/**
 * OPS-360 Unit 3 — «الثقة والسلامة»: a REAL moderation queue. Server-first.
 *
 * This is the fix that makes the MODERATOR role (analytics.read +
 * moderation.queue only) actually able to work: it reads ONLY the
 * moderation-scoped endpoints — never /ops/projects, which MODERATOR cannot
 * read:
 *
 *   • /ops/moderation/reports          → the unified open-report queue
 *   • /ops/moderation/comments?reported→ the reported-comments browser
 *   • /ops/dashboard                   → the open-report counts (stat tiles)
 *
 * Both lists page independently by their own cursor; the active tab is carried
 * in the URL (?tab=) so a «التالي» navigation lands back on the right tab.
 * Every subject an operator acts on is a real row with a governed OpRunner —
 * the old blind "paste a subject id" cards are gone. 403 on the queue → amber.
 */

interface DashboardCounts {
  workQueue: {
    reportsOpen: number;
    projectReportsOpen: number;
    commentReportsOpen: number;
  };
}

interface PageBody<T> {
  items: T[];
  nextCursor: string | null;
}

export default async function OpsTrustPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const tab = sp.tab === 'comments' ? 'comments' : 'reports';
  const headers = { 'x-ops-token': opsToken } as const;

  let counts: DashboardCounts['workQueue'] | null = null;
  let reports: TrustReportRow[] = [];
  let comments: TrustCommentRow[] = [];
  let reportsCursor: string | null = null;
  let commentsCursor: string | null = null;
  let refused = false;

  try {
    const [dashRes, repRes, comRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/dashboard`, { headers, cache: 'no-store' }),
      fetch(
        `${API_BASE}/v1/ops/moderation/reports${qs({
          cursor: tab === 'reports' ? sp.cursor : undefined,
          limit: '50',
        })}`,
        { headers, cache: 'no-store' },
      ),
      fetch(
        `${API_BASE}/v1/ops/moderation/comments${qs({
          reported: 'true',
          cursor: tab === 'comments' ? sp.cursor : undefined,
          limit: '50',
        })}`,
        { headers, cache: 'no-store' },
      ),
    ]);

    if (repRes.status === 403 || comRes.status === 403) refused = true;
    if (dashRes.ok) counts = ((await dashRes.json()) as DashboardCounts).workQueue;
    if (repRes.ok) {
      const body = (await repRes.json()) as PageBody<TrustReportRow>;
      reports = body.items;
      reportsCursor = body.nextCursor;
    }
    if (comRes.ok) {
      const body = (await comRes.json()) as PageBody<TrustCommentRow>;
      comments = body.items;
      commentsCursor = body.nextCursor;
    }
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  const activeCursor = tab === 'reports' ? reportsCursor : commentsCursor;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الثقة والسلامة</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            طابور الإشراف الحقيقي — بلاغات المشاريع والتعليقات وتصفّح التعليقات المُبلَّغ عنها، مع
            إجراءات الإخفاء والحظر ورفض البلاغات. كل إجراء عملية محكومة ومدوَّنة في التدقيق.
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
          value={(counts?.reportsOpen ?? 0).toLocaleString('ar-SA-u-nu-latn')}
          intent={counts && counts.reportsOpen > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="بلاغات على المشاريع"
          value={(counts?.projectReportsOpen ?? 0).toLocaleString('ar-SA-u-nu-latn')}
          intent={counts && counts.projectReportsOpen > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="بلاغات على التعليقات"
          value={(counts?.commentReportsOpen ?? 0).toLocaleString('ar-SA-u-nu-latn')}
          intent={counts && counts.commentReportsOpen > 0 ? 'warn' : 'default'}
        />
      </section>

      <ModerationQueue reports={reports} comments={comments} initialTab={tab} />

      {activeCursor ? (
        <div className="text-center">
          <Link
            href={`/ops/trust${qs({ tab, cursor: activeCursor })}`}
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            التالي ↓
          </Link>
        </div>
      ) : null}

      <p className="text-xs text-[#8b949e]">
        ملاحظة: «إخفاء سؤال شائع» (faq.question.hide) تُنفَّذ من صفحة المشروع أو عبر لوحة الأوامر
        (Ctrl+K) — لا صندوق لصق أعمى هنا؛ قوائم الأسئلة الشائعة مرتبطة بمشاريع لا يستطيع دور المُشرِف
        قراءتها.
      </p>
    </div>
  );
}
