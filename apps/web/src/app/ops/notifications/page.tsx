import Link from 'next/link';

import { StatTile } from '../_components/stat-tile';
import { FilterForm } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { NotificationsTable, type NotificationRow } from './_components/notifications-table';

/**
 * OPS-360 Unit 4 — «الإشعارات»: a notifications INSPECTOR. This closes the
 * "the Notification model is write-only / unobservable" gap.
 *
 * Two panes, both server-first (guard → ops-token fetch → 403 amber):
 *  1. Delivery mix — GET /v1/ops/notifications/stats rendered as count-by-kind
 *     tiles over the last 30 days.
 *  2. Per-user lookup — a plain GET form takes a userId; when present we fetch
 *     GET /v1/ops/users/:id/notifications into the shared <DataTable>.
 *
 * READ-ONLY: no resend op exists yet (a Unit-6 follow-up) — we deliberately do
 * NOT render a resend button. If either endpoint 404s (backend not yet landed)
 * we degrade to an amber "قيد الإنشاء" note rather than fabricating data.
 */

interface NotificationStats {
  /** Normalised: kind → count over the window. */
  countsByKind: Array<{ kind: string; count: number }>;
  total: number;
  windowDays: number;
}

/** Accept either { byKind:[{kind,count}] } or a { counts: Record } shape. */
function normaliseStats(raw: unknown): NotificationStats {
  const o = (raw ?? {}) as Record<string, unknown>;
  let counts: Array<{ kind: string; count: number }> = [];
  const arr =
    (o.byKind as unknown) ?? (o.countsByKind as unknown) ?? (o.items as unknown);
  if (Array.isArray(arr)) {
    counts = arr
      .map((e) => {
        const r = e as Record<string, unknown>;
        return { kind: String(r.kind ?? r.key ?? ''), count: Number(r.count ?? r.value ?? 0) };
      })
      .filter((c) => c.kind);
  } else {
    const rec = (o.counts ?? o.countsByKind ?? o.byKind) as
      | Record<string, number>
      | undefined;
    if (rec && typeof rec === 'object') {
      counts = Object.entries(rec).map(([kind, count]) => ({ kind, count: Number(count) }));
    }
  }
  counts.sort((a, b) => b.count - a.count);
  const total =
    typeof o.total === 'number' ? o.total : counts.reduce((s, c) => s + c.count, 0);
  const windowDays = typeof o.windowDays === 'number' ? o.windowDays : 30;
  return { countsByKind: counts, total, windowDays };
}

const STATS_INTENTS: Array<'default' | 'ok' | 'warn'> = ['ok', 'default', 'warn', 'default'];

export default async function OpsNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;
  const userId = sp.userId?.trim() || '';

  const opts = { headers: { 'x-ops-token': opsToken }, cache: 'no-store' as const };

  let stats: NotificationStats | null = null;
  let statsRefused = false;
  let statsMissing = false;

  let rows: NotificationRow[] = [];
  let lookupRefused = false;
  let lookupMissing = false;
  let lookupError = false;

  try {
    const sRes = await fetch(`${API_BASE}/v1/ops/notifications/stats`, opts);
    if (sRes.status === 403) statsRefused = true;
    else if (sRes.status === 404) statsMissing = true;
    else if (sRes.ok) stats = normaliseStats(await sRes.json());
  } catch {
    /* API unreachable — empty state renders below */
  }

  if (userId) {
    try {
      const r = await fetch(
        `${API_BASE}/v1/ops/users/${encodeURIComponent(userId)}/notifications?limit=100`,
        opts,
      );
      if (r.status === 403) lookupRefused = true;
      else if (r.status === 404) lookupMissing = true;
      else if (r.ok) {
        const body = (await r.json()) as { items?: NotificationRow[] } | NotificationRow[];
        rows = Array.isArray(body) ? body : (body.items ?? []);
      } else {
        lookupError = true;
      }
    } catch {
      lookupError = true;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الإشعارات</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            مفتّش الإشعارات — توزيع التسليم آخر 30 يوماً، مع بحث لكل مستخدم يجعل نموذج الإشعارات
            (المكتوب فقط) قابلاً للملاحظة. للقراءة فقط.
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {statsRefused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية عرض إحصاءات الإشعارات — اطلبها من المالك.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[#8b949e]">
          توزيع التسليم{' '}
          {stats ? (
            <span className="text-[11px] font-normal text-[#484f58]">
              (آخر {stats.windowDays.toLocaleString('ar-SA')} يوماً)
            </span>
          ) : null}
        </h2>
        {statsMissing ? (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            قيد الإنشاء — نقطة GET /v1/ops/notifications/stats لم تُنشر بعد.
          </p>
        ) : stats && stats.countsByKind.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="إجمالي الإشعارات" value={stats.total.toLocaleString('ar-SA')} />
            {stats.countsByKind.slice(0, 7).map((c, i) => (
              <StatTile
                key={c.kind}
                label={c.kind}
                value={c.count.toLocaleString('ar-SA')}
                intent={c.count > 0 ? STATS_INTENTS[i % STATS_INTENTS.length] : 'default'}
              />
            ))}
          </div>
        ) : !statsRefused ? (
          <p className="rounded border border-[#21262d] bg-[#161b22] px-4 py-6 text-center text-sm text-[#8b949e]">
            لا إحصاءات إشعارات متاحة.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[#8b949e]">بحث الإشعارات لكل مستخدم</h2>
        <p className="text-xs text-[#8b949e]">
          الصق معرّف المستخدم (UUID) لعرض إشعاراته. البيانات مُقنَّعة من الخادم — لا PII خام.
        </p>
        <FilterForm
          fields={[
            { kind: 'text', name: 'userId', placeholderAr: 'معرّف المستخدم (UUID)', labelAr: 'المستخدم' },
          ]}
          values={sp}
          submitLabelAr="عرض"
        />

        {userId ? (
          <>
            <p className="text-xs text-[#484f58]">
              المستخدم:{' '}
              <Link
                href={`/ops/users/${userId}`}
                dir="ltr"
                className="font-mono text-[#58a6ff] hover:underline"
              >
                {userId}
              </Link>
            </p>
            {lookupRefused ? (
              <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                تفتقد صلاحية عرض إشعارات هذا المستخدم.
              </p>
            ) : lookupMissing ? (
              <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                قيد الإنشاء — نقطة GET /v1/ops/users/:id/notifications لم تُنشر بعد (أو المستخدم غير
                موجود).
              </p>
            ) : lookupError ? (
              <p className="rounded border border-[#21262d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
                تعذّر تحميل الإشعارات.
              </p>
            ) : (
              <NotificationsTable rows={rows} />
            )}
          </>
        ) : (
          <p className="rounded border border-[#21262d] bg-[#161b22] px-4 py-6 text-center text-sm text-[#8b949e]">
            أدخل معرّف مستخدم أعلاه لعرض إشعاراته.
          </p>
        )}
      </section>

      <p className="rounded border border-[#21262d] bg-[#0d1117] px-3 py-2.5 text-[11px] text-[#484f58]">
        ملاحظة: لا توجد عملية «إعادة إرسال» بعد — إتاحتها متابعة ضمن الوحدة 6. هذه الشاشة للملاحظة فقط.
      </p>
    </div>
  );
}
