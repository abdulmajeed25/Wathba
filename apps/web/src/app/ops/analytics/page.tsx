import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { StatTile } from '../_components/stat-tile';
import { FilterForm } from '../_lib/filters';
import { formatSar } from '../_lib/money';

/**
 * OPS Part 5 — «القياس والتقارير»: an HONEST, read-only measurement surface.
 *
 * There is no analytics aggregate endpoint yet — only /v1/ops/dashboard. So
 * this page shows exactly what that snapshot can support: the platform vitals,
 * plus a handful of ratios DERIVABLE from the dashboard counts (each labelled
 * with its formula and the population it is measured over). Anything that would
 * need data the snapshot does not carry — success rate, refund rate against a
 * real base, or any time series — is rendered as «بانتظار نقطة تجميع» rather
 * than fabricated. The date-range filter is scaffolding: a forward hook for the
 * day /dashboard accepts a window; today it does not filter, and the page says
 * so plainly.
 */

interface Dashboard {
  workQueue: {
    projectsUnderReview: number;
    milestonesSubmitted: number;
    payoutsPending: number;
    payoutsFailed: number;
    reportsOpen: number;
    projectReportsOpen: number;
    commentReportsOpen: number;
    pledgesCaptureGrace: number;
    pledgesFailedCapture: number;
    ticketsOpen: number;
  };
  vitals: {
    liveRaisedHalalas: string;
    liveCount: number;
    usersCount: number;
    gmvHalalas: string;
    pendingPayoutLiabilityHalalas: string;
    refundCount: number;
  };
  generatedAt: string;
}

const ar = (n: number) => n.toLocaleString('ar-SA');

/** A ratio numerator/denominator as an ar-SA percentage, or null when base=0. */
function ratio(num: number, den: number): { pct: string; num: number; den: number } | null {
  if (den <= 0) return null;
  const pct = (num / den).toLocaleString('ar-SA', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return { pct, num, den };
}

function DerivedTile({
  label,
  r,
  formula,
  intent = 'default',
}: {
  label: string;
  r: { pct: string; num: number; den: number } | null;
  formula: string;
  intent?: 'default' | 'ok' | 'warn' | 'danger';
}) {
  return (
    <StatTile
      label={label}
      value={r ? r.pct : '—'}
      hint={r ? `${formula} = ${ar(r.num)} ÷ ${ar(r.den)}` : `${formula} — لا بيانات كافية`}
      intent={r && r.num > 0 ? intent : 'default'}
    />
  );
}

function Pending({ label, why }: { label: string; why: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#30363d] bg-[#0d1117] p-4">
      <p className="text-xs text-[#8b949e]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#484f58]">بانتظار نقطة تجميع</p>
      <p className="mt-1 text-[11px] text-[#484f58]">{why}</p>
    </div>
  );
}

export default async function OpsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  let data: Dashboard | null = null;
  let refused = false;
  try {
    // NOTE: /dashboard does not yet accept a date window; from/to are captured
    // in the filter as a forward hook and intentionally NOT sent.
    const r = await fetch(`${API_BASE}/v1/ops/dashboard`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.status === 403) refused = true;
    if (r.ok) data = (await r.json()) as Dashboard;
  } catch {
    /* API unreachable — the page renders its empty/refused states below. */
  }

  const wq = data?.workQueue;
  const v = data?.vitals;

  const payoutFailureShare = wq
    ? ratio(wq.payoutsFailed, wq.payoutsPending + wq.payoutsFailed)
    : null;
  const captureFailureShare = wq
    ? ratio(wq.pledgesFailedCapture, wq.pledgesCaptureGrace + wq.pledgesFailedCapture)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">القياس والتقارير</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            لقطة حيّة من لوحة القيادة — كل رقم موسوم بمصدره، ولا رقم مُقدَّر أو مُلفَّق
            {data ? ` · حُدِّثت ${new Date(data.generatedAt).toLocaleString('ar-SA')}` : ''}
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية analytics.read — اطلب دور ANALYST أو أعلى من المالك.
        </p>
      ) : null}

      {!data && !refused ? (
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          تعذّر جلب المؤشرات الآن — تحقّق من اتصال واجهة العمليات ثم أعد التحميل.
        </p>
      ) : null}

      {/* ── Date-range filter — forward hook (not yet applied) ─────────────── */}
      <div>
        <FilterForm
          fields={[
            { kind: 'date', name: 'from', labelAr: 'من تاريخ' },
            { kind: 'date', name: 'to', labelAr: 'إلى تاريخ' },
          ]}
          values={sp}
          submitLabelAr="تطبيق النطاق"
        />
        <p className="mt-2 text-[11px] text-[#484f58]">
          نطاق التاريخ محجوز لواجهة تجميع قادمة — القيم تُحفظ في الرابط لكنها لا تُرشّح
          الأرقام الحالية بعد. اللقطة أدناه لحظية عبر كامل المنصّة.
        </p>
      </div>

      {/* ── Platform vitals (verbatim from /dashboard) ────────────────────── */}
      <section aria-labelledby="vitals-h">
        <h2 id="vitals-h" className="mb-3 text-base font-bold">
          المؤشرات الحيوية
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="المبلغ المُجمَّع (مشاريع حيّة)"
            value={formatSar(v?.liveRaisedHalalas)}
            hint="مجموع raisedHalalas — LIVE"
          />
          <StatTile label="مشاريع حيّة" value={ar(v?.liveCount ?? 0)} hint="حالة LIVE" />
          <StatTile label="المستخدمون" value={ar(v?.usersCount ?? 0)} hint="إجمالي الحسابات" />
          <StatTile
            label="إجمالي المبيعات (GMV)"
            value={formatSar(v?.gmvHalalas)}
            hint="مجموع realizedHalalas"
          />
          <StatTile
            label="التزام المدفوعات المعلّقة"
            value={formatSar(v?.pendingPayoutLiabilityHalalas)}
            hint="المستحق صرفه — payouts PENDING"
            intent={v && v.pendingPayoutLiabilityHalalas !== '0' ? 'warn' : 'default'}
          />
          <StatTile
            label="التعهدات المستردّة"
            value={ar(v?.refundCount ?? 0)}
            hint="حالة REFUNDED (عدد)"
          />
        </div>
      </section>

      {/* ── Derived ratios (computed here from the counts above) ───────────── */}
      <section aria-labelledby="ratios-h">
        <h2 id="ratios-h" className="mb-1 text-base font-bold">
          نسب مشتقّة
        </h2>
        <p className="mb-3 text-[11px] text-[#8b949e]">
          محسوبة من عدّادات لوحة القيادة — كل نسبة مقيسة على مجتمعها الظاهر في التلميح، لا
          على كامل التاريخ.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DerivedTile
            label="نسبة فشل الصرف"
            r={payoutFailureShare}
            formula="فاشلة ÷ (معلّقة + فاشلة)"
            intent="danger"
          />
          <DerivedTile
            label="نسبة فشل السحب"
            r={captureFailureShare}
            formula="فشل سحب ÷ (مهلة سحب + فشل سحب)"
            intent="danger"
          />
          <StatTile
            label="التزام قيد الصرف"
            value={formatSar(v?.pendingPayoutLiabilityHalalas)}
            hint="القيمة المالية المعلّقة الآن"
            intent={v && v.pendingPayoutLiabilityHalalas !== '0' ? 'warn' : 'default'}
          />
        </div>
      </section>

      {/* ── Honest gaps: what needs a real aggregate endpoint ─────────────── */}
      <section aria-labelledby="gaps-h">
        <h2 id="gaps-h" className="mb-3 text-base font-bold">
          مؤشرات بانتظار واجهة تجميع
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Pending
            label="معدل نجاح المدفوعات"
            why="يلزم عدّاد المدفوعات الناجحة (غير متوفّر في لقطة لوحة القيادة)"
          />
          <Pending
            label="معدل الاسترداد"
            why="يلزم إجمالي التعهدات كقاعدة للنسبة (اللقطة تعطي العدد فقط)"
          />
          <Pending
            label="الاتجاهات الزمنية"
            why="يلزم سلسلة زمنية مُجمَّعة عبر النطاق — الرابط يحفظ التواريخ استعداداً لها"
          />
        </div>
      </section>

      {/* ── Financial trends live in the ledgers ──────────────────────────── */}
      <section aria-labelledby="finance-h">
        <h2 id="finance-h" className="mb-3 text-base font-bold">
          الاتجاهات المالية التفصيلية
        </h2>
        <p className="mb-3 text-sm text-[#8b949e]">
          الحركة المالية سطراً بسطر تُستعرض وتُطابَق في شاشات المال — لا تُلخَّص هنا حتى لا
          تُقرأ اللقطة كأنها دفتر.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            { href: '/ops/money/ledger', labelAr: 'دفتر الأستاذ' },
            { href: '/ops/money/reconciliation', labelAr: 'المطابقة' },
            { href: '/ops/money', labelAr: 'المال (المدفوعات والتعهدات)' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 hover:bg-[#21262d]"
            >
              {l.labelAr} ←
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
