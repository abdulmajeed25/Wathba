import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { FilterForm } from '../_lib/filters';

/**
 * Batch DISCOVERY-ENGINE Unit 5 — «الاكتشاف»: what readers filtered by, and
 * what the nightly pass did about it.
 *
 * Built on the /ops/analytics conventions (same guard, same window control,
 * same honest-null posture) but its own page, because the question is
 * different: the analytics screens ask how the business is doing; this one asks
 * whether the homepage's automatic chip row is telling the truth.
 *
 * TWO TABLES, and both are necessary. The promoted row alone would be
 * unauditable — an operator looking at a chip nobody chose needs the count that
 * put it there, and needs to see the facets that were applied MORE often and
 * still did not make it (below the threshold, or no Arabic label).
 *
 * PDPL, stated on the page and not only in the code: the aggregate groups by
 * (dimension, value). No anonId, no userId, no per-user filter profile.
 */

export const dynamic = 'force-dynamic';

interface AppliedRow {
  key: string;
  value: string;
  count: number;
}

interface PromotedRow {
  key: string;
  value: string;
  labelAr: string;
  score: number;
  eventCount: number;
  isSeed: boolean;
  isPinned: boolean;
  isActive: boolean;
  sortOrder: number;
  computedAt: string;
}

interface DiscoveryDto {
  // `defaultDays`, NOT `days`. The API's ResolvedWindow has always called it
  // defaultDays; this DTO invented `days`, so data.window.days was undefined
  // and arInt(undefined) threw — the whole board answered HTTP 500. A hand
  // written DTO that disagrees with the service compiles perfectly.
  window: { from: string | null; to: string | null; defaultDays: number };
  applied: AppliedRow[];
  promoted: PromotedRow[];
  notes: { privacy: string; seeds: string };
  generatedAt: string;
}

/** The Arabic name of a discovery dimension. A slug is not a UI. */
const DIMENSION_AR: Record<string, string> = {
  status: 'الحالة',
  cat: 'الفئة',
  tag: 'الوسم',
  region: 'المنطقة',
  pct: 'نسبة التمويل',
  only: 'عرض فقط',
  collection: 'المجموعة',
  hasVideo: 'الوسائط',
  duration: 'مدة الحملة',
  sort: 'الترتيب',
};

const TH = 'border-b border-[#21262d] px-3 py-2 text-start text-xs font-bold text-[#8b949e]';
const TD = 'border-b border-[#21262d] px-3 py-2 text-sm text-[#c9d1d9]';

const arInt = (n: number): string => n.toLocaleString('ar-SA');

function Pill({ text, tone }: { text: string; tone: 'ok' | 'muted' | 'warn' }) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-800 bg-emerald-950 text-emerald-400'
      : tone === 'warn'
        ? 'border-amber-800 bg-amber-950 text-amber-400'
        : 'border-[#30363d] bg-[#161b22] text-[#8b949e]';
  return <span className={`rounded border px-2 py-0.5 text-[11px] ${cls}`}>{text}</span>;
}

export default async function OpsDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const u = new URLSearchParams();
  if (sp.from) u.set('from', sp.from);
  if (sp.to) u.set('to', sp.to);
  const query = u.toString();

  let data: DiscoveryDto | null = null;
  // 0 means "never reached the service" — the same distinction /ops/analytics
  // draws between a refusal it can explain and an outage it cannot.
  let status: number;
  try {
    const r = await fetch(`${API_BASE}/v1/ops/analytics/discovery${query ? `?${query}` : ''}`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    status = r.status;
    if (r.ok) data = (await r.json()) as DiscoveryDto;
  } catch {
    status = 0;
  }

  // Which applied pairs actually made the row — so the second table can answer
  // "why isn't this one showing?" without the operator cross-reading by eye.
  const promotedKeys = new Set(
    (data?.promoted ?? []).filter((p) => p.isActive).map((p) => `${p.key}:${p.value}`),
  );

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-bold text-[#c9d1d9]">الاكتشاف</h1>
      <p className="mb-4 text-sm text-[#8b949e]">
        الفلاتر التي استخدمها الزوّار فعلاً، والصف الذي بنته الحسبة الليلية على الصفحة الرئيسية.
      </p>

      <FilterForm
        fields={[
          { kind: 'date', name: 'from', labelAr: 'من تاريخ' },
          { kind: 'date', name: 'to', labelAr: 'إلى تاريخ' },
        ]}
        values={sp}
        submitLabelAr="تطبيق النطاق"
      />

      {status === 403 && (
        <p className="mt-5 text-sm text-[#8b949e]">لا تملك صلاحية «analytics.read» لعرض هذه الصفحة.</p>
      )}
      {status !== 403 && !data && (
        <p className="mt-5 text-sm text-[#8b949e]">تعذّر الوصول إلى الخدمة.</p>
      )}

      {data && (
        <>
          <section className="mt-7">
            <h2 className="text-base font-bold text-[#c9d1d9]">الصف المعروض الآن</h2>
            <p className="mb-3 mt-1 text-xs text-[#8b949e]">{data.notes.seeds}</p>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>الفلتر</th>
                  <th className={TH}>المعيار</th>
                  <th className={TH}>الأحداث</th>
                  <th className={TH}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {data.promoted.map((p) => (
                  <tr key={`${p.key}:${p.value}`} data-facet={`${p.key}:${p.value}`}>
                    <td className={TD}>{p.labelAr}</td>
                    <td className={TD}>{DIMENSION_AR[p.key] ?? p.key}</td>
                    {/* A seed has no events BY DEFINITION — «—», not «٠», which
                        would read as "measured zero" rather than "not measured". */}
                    <td className={`${TD} tabular-nums`}>{p.isSeed ? '—' : arInt(p.eventCount)}</td>
                    <td className={TD}>
                      <span className="flex flex-wrap gap-1.5">
                        {p.isPinned && <Pill text="مثبَّت" tone="ok" />}
                        {p.isSeed && <Pill text="قيمة انطلاق" tone="warn" />}
                        {!p.isActive && <Pill text="غير معروض" tone="muted" />}
                        {p.isActive && !p.isSeed && !p.isPinned && <Pill text="محسوب" tone="muted" />}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.promoted.length === 0 && (
                  <tr>
                    <td className={TD} colSpan={4}>لا توجد صفوف بعد.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-[#8b949e]">
              التثبيت وإلغاؤه يتمّان عبر عملية «تثبيت/إلغاء تثبيت فلتر مقترح» في مركز العمليات — لا يوجد
              زر مباشر هنا لأن التغيير يجب أن يمرّ بسجل التدقيق.
            </p>
          </section>

          <section className="mt-9">
            <h2 className="text-base font-bold text-[#c9d1d9]">الأكثر تطبيقاً في المدة</h2>
            <p className="mb-3 mt-1 text-xs text-[#8b949e]">
              {arInt(data.window.defaultDays)} يوماً · {data.notes.privacy}
            </p>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>المعيار</th>
                  <th className={TH}>القيمة</th>
                  <th className={TH}>مرّات التطبيق</th>
                  <th className={TH}>معروض؟</th>
                </tr>
              </thead>
              <tbody>
                {data.applied.map((a) => (
                  <tr key={`${a.key}:${a.value}`}>
                    <td className={TD}>{DIMENSION_AR[a.key] ?? a.key}</td>
                    {/* Slugs and enum values are Latin — LTR inside an RTL page,
                        or «p75_100» renders with its parts reordered. */}
                    <td className={`${TD} text-start`} dir="ltr">{a.value}</td>
                    <td className={`${TD} tabular-nums`}>{arInt(a.count)}</td>
                    <td className={TD}>
                      {promotedKeys.has(`${a.key}:${a.value}`) ? (
                        <Pill text="نعم" tone="ok" />
                      ) : (
                        <Pill text="لا" tone="muted" />
                      )}
                    </td>
                  </tr>
                ))}
                {data.applied.length === 0 && (
                  <tr>
                    <td className={TD} colSpan={4}>لم تُسجَّل أي فلاتر في هذه المدة.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
