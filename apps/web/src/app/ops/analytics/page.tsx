import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { StatTile } from '../_components/stat-tile';
import { StatusBadge } from '../_components/badge';
import { FilterForm } from '../_lib/filters';
import { formatSar } from '../_lib/money';
import {
  arInt,
  fmtPct,
  pctIntent,
  intentText,
  pickPct,
  labelOf,
  statusIntent,
  PROJECT_STATUS_AR,
  REP_TIER_AR,
  TICKET_STATUS_AR,
  type CategoryRow,
  type Intent,
} from './_lib/labels';
import { Bar, DistributionBars, Unavailable, MetricCell } from './_components/bars';
import { Funnel, type FunnelStage } from './_components/funnel';
import { CategoryTable } from './_components/category-table';

/**
 * OPS-360 Phase B Unit 5 — «القياس والتقارير», rebuilt as a first-class analytics
 * surface over the five aggregate endpoints (GET /v1/ops/analytics/*).
 *
 * Server-first: one Promise.all fetch of financial + funnel + projects + users +
 * operations, all windowed by ?from&to (the date-range control now truly drives
 * the query — no more dead no-op filter). The financial report needs
 * `money.execute`; if that alone is refused (403) it degrades to a permission
 * note while every other section still renders. Any metric the API returns null
 * for is rendered as an HONEST «غير متاح / بيانات غير متوفرة» state with its
 * reason — never fabricated, never shown as 0.
 */

interface WindowMeta {
  from: string | null;
  to: string | null;
  days: number;
}

interface FinancialDto {
  gmvHalalas: string;
  commissionEarnedHalalas: string;
  vatCollectedHalalas: string;
  grossPledgedHalalas: string;
  refundTotalHalalas: string;
  refundCount: number;
  payoutSentHalalas: string;
  pendingPayoutGrossHalalas: string;
  pendingPayoutLiabilityNetHalalas: string;
  pendingLiabilityIsSnapshot: boolean;
  window: WindowMeta;
  generatedAt: string;
}

interface FunnelDto {
  stages: {
    visits: number | null;
    signups: number;
    emailVerified: number;
    nafathVerified: number;
    pledgers: number;
    repeatPledgers: number;
  };
  // CLOSEOUT C5 — the API key is `dropOff` (see ops-analytics.service.ts); this
  // read `dropoffs`, so the object was undefined and the screen 500ed on every
  // load. The e2e that would have caught it was gate-skipped by a broken health
  // probe, so a hard-crashing analytics page shipped unnoticed.
  dropOff: {
    visitToSignupPct: number | null;
    signupToEmailVerifiedPct: number | null;
    emailVerifiedToNafathVerifiedPct: number | null;
    pledgerToRepeatPct: number | null;
  };
  notes: { topOfFunnel: string };
}

interface ProjectsDto {
  successRatePct: number | null;
  concludedCount: number;
  wonCount: number;
  lostCount: number;
  statusDistribution: Record<string, number>;
  totalProjects: number;
  perCategory: Array<{
    categoryId: string;
    nameAr: string;
    projectCount: number;
    raisedHalalas: string;
  }>;
  pledgedVsRealized: {
    pledgedHalalas: string;
    realizedHalalas: string;
    realizationRatePct: number | null;
  };
}

interface UsersDto {
  totalUsers: number;
  newUsersInWindow: number;
  kyc: { nafathVerified: number; total: number; conversionPct: number | null };
  distinctBackers: number;
  distinctBackersInWindow: number;
  reputationTiers: Record<string, number>;
  activeSessionCount: number;
  suspendedCount: number;
  bannedCount: number;
}

interface OperationsDto {
  captureFailure: Record<string, unknown>;
  refundRate: Record<string, unknown>;
  disputeRate: Record<string, unknown>;
  moderation: {
    projectReportsOpened: number;
    projectReportsResolved: number;
    projectThroughputPct: number | null;
    commentReportsOpened: number;
    commentReportsResolved: number | null;
    // CLOSEOUT C1 — computable since CommentReport.resolvedAt landed. Kept
    // nullable: the null-state rendering stays honest on an older API.
    commentThroughputPct?: number | null;
  };
  supportTicketsByStatus: Record<string, number>;
  payoutSuccess: Record<string, unknown>;
}

type Fetched<T> = { status: number; data: T | null };

async function getJson<T>(path: string, opsToken: string): Promise<Fetched<T>> {
  try {
    const r = await fetch(`${API_BASE}/v1/ops/analytics/${path}`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.ok) return { status: r.status, data: (await r.json()) as T };
    return { status: r.status, data: null };
  } catch {
    return { status: 0, data: null };
  }
}

function windowQs(from?: string, to?: string): string {
  const u = new URLSearchParams();
  if (from) u.set('from', from);
  if (to) u.set('to', to);
  const s = u.toString();
  return s ? `?${s}` : '';
}

/** A percentage as a compact metric cell, honest «غير متاح» when null. */
function PctMetric({
  label,
  pct,
  direction,
  reason,
}: {
  label: string;
  pct: number | null;
  direction: 'higher' | 'lower';
  reason: string;
}) {
  if (pct === null || pct === undefined) {
    return (
      <MetricCell
        label={label}
        value={
          <span title={reason} className="text-sm text-[#484f58]">
            غير متاح
          </span>
        }
        hint={reason}
      />
    );
  }
  return <MetricCell label={label} value={fmtPct(pct)} intent={pctIntent(pct, direction)} />;
}

const H2 = 'mb-3 text-base font-bold';

export default async function OpsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;
  const q = windowQs(sp.from, sp.to);

  const [fin, funnel, projects, users, operations] = await Promise.all([
    getJson<FinancialDto>(`financial${q}`, opsToken),
    getJson<FunnelDto>(`funnel${q}`, opsToken),
    getJson<ProjectsDto>(`projects${q}`, opsToken),
    getJson<UsersDto>(`users${q}`, opsToken),
    getJson<OperationsDto>(`operations${q}`, opsToken),
  ]);

  // analytics.read is refused → the four non-financial sections can't render.
  const analyticsRefused = [funnel, projects, users, operations].some((f) => f.status === 403);
  const financialRefused = fin.status === 403;
  const anyUnreachable =
    !fin.data && !funnel.data && !projects.data && !users.data && !operations.data && !analyticsRefused;

  // Resolved window: prefer the financial DTO's own window; else echo the query.
  const win: WindowMeta | null =
    fin.data?.window ??
    (sp.from || sp.to ? { from: sp.from ?? null, to: sp.to ?? null, days: 0 } : null);
  const winLabel = win
    ? `${win.from ? new Date(win.from).toLocaleDateString('ar-SA') : '—'} ← ${
        win.to ? new Date(win.to).toLocaleDateString('ar-SA') : '—'
      }${win.days ? ` · ${arInt(win.days)} يوم` : ''}`
    : 'النطاق الافتراضي (كل الوقت)';

  const f = funnel.data;
  const funnelStages: FunnelStage[] = f
    ? [
        { key: 'signups', label: 'التسجيلات', value: f.stages.signups },
        {
          key: 'emailVerified',
          label: 'تأكيد البريد',
          value: f.stages.emailVerified,
          retentionPct: f.dropOff.signupToEmailVerifiedPct,
        },
        {
          key: 'nafathVerified',
          label: 'توثيق نفاذ',
          value: f.stages.nafathVerified,
          retentionPct: f.dropOff.emailVerifiedToNafathVerifiedPct,
        },
        { key: 'pledgers', label: 'المتعهّدون', value: f.stages.pledgers, retentionPct: null },
        {
          key: 'repeatPledgers',
          label: 'تعهّد متكرّر',
          value: f.stages.repeatPledgers,
          retentionPct: f.dropOff.pledgerToRepeatPct,
        },
      ]
    : [];

  const p = projects.data;
  const categoryRows: CategoryRow[] = (p?.perCategory ?? []).map((c) => ({
    id: c.categoryId,
    categoryId: c.categoryId,
    nameAr: c.nameAr,
    projectCount: c.projectCount,
    raisedHalalas: c.raisedHalalas,
  }));

  const u = users.data;
  const o = operations.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">القياس والتقارير</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            صحّة المنصّة كاملة عبر خمس واجهات تجميع — مالية، قمع التحويل، المشاريع، المستخدمون،
            التشغيل. كل رقم مصدره الواجهة، والمفقود يُعرض «غير متاح» لا صفراً.
            {fin.data ? ` · حُدِّثت ${new Date(fin.data.generatedAt).toLocaleString('ar-SA')}` : ''}
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {analyticsRefused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية analytics.read — اطلب دور ANALYST أو أعلى من المالك لعرض التحليلات.
        </p>
      ) : null}

      {anyUnreachable ? (
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          تعذّر جلب المؤشرات الآن — تحقّق من اتصال واجهة العمليات ثم أعد التحميل.
        </p>
      ) : null}

      {/* ── Date-range control — now drives all five fetches ──────────────── */}
      <div>
        <FilterForm
          fields={[
            { kind: 'date', name: 'from', labelAr: 'من تاريخ' },
            { kind: 'date', name: 'to', labelAr: 'إلى تاريخ' },
          ]}
          values={sp}
          submitLabelAr="تطبيق النطاق"
        />
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#8b949e]">
          <span>النطاق المُطبَّق على كل الأقسام:</span>
          <span className="rounded border border-[#30363d] bg-[#161b22] px-2 py-0.5 font-bold text-[#c9d1d9]">
            {winLabel}
          </span>
        </p>
      </div>

      {/* ── 1) Financial report (needs money.execute) ─────────────────────── */}
      <section aria-labelledby="fin-h">
        <h2 id="fin-h" className={H2}>
          التقرير المالي
        </h2>
        {financialRefused ? (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            هذا القسم يتطلّب صلاحية money.execute — بقية التحليلات معروضة، أمّا الأرقام المالية
            فمحجوبة حتى تُمنح الصلاحية.
          </p>
        ) : fin.data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="إجمالي المبيعات (GMV)" value={formatSar(fin.data.gmvHalalas)} hint="القيمة المحقَّقة" />
            <StatTile label="العمولة المحصّلة" value={formatSar(fin.data.commissionEarnedHalalas)} hint="دخل المنصّة" />
            <StatTile label="ضريبة القيمة المضافة" value={formatSar(fin.data.vatCollectedHalalas)} hint="VAT محصّلة" />
            <StatTile label="إجمالي التعهّدات" value={formatSar(fin.data.grossPledgedHalalas)} hint="القيمة المتعهَّد بها" />
            <StatTile
              label="الاستردادات"
              value={formatSar(fin.data.refundTotalHalalas)}
              hint={`${arInt(fin.data.refundCount)} عملية استرداد`}
              intent={fin.data.refundCount > 0 ? 'warn' : 'default'}
            />
            <StatTile label="المدفوعات المصروفة" value={formatSar(fin.data.payoutSentHalalas)} hint="payouts SENT" />
            <StatTile
              label="المدفوعات المعلّقة (إجمالي)"
              value={formatSar(fin.data.pendingPayoutGrossHalalas)}
              hint="قبل خصم العمولة"
            />
            <StatTile
              label="الالتزام المعلّق (صافٍ)"
              value={
                <span className="flex items-center gap-2">
                  {formatSar(fin.data.pendingPayoutLiabilityNetHalalas)}
                  {fin.data.pendingLiabilityIsSnapshot ? <StatusBadge intent="info">لقطة</StatusBadge> : null}
                </span>
              }
              hint={
                fin.data.pendingLiabilityIsSnapshot
                  ? 'قيمة لقطة — قد تختلف عن الحساب اللحظي'
                  : 'صافي المستحق للصرف'
              }
              intent={fin.data.pendingPayoutLiabilityNetHalalas !== '0' ? 'warn' : 'default'}
            />
          </div>
        ) : (
          <Unavailable
            label="التقرير المالي"
            reason="تعذّر جلب واجهة /analytics/financial — تحقّق من الاتصال"
          />
        )}
      </section>

      {/* ── 2) Funnel ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="funnel-h">
        <h2 id="funnel-h" className={H2}>
          قمع التحويل
        </h2>
        {f ? (
          <Funnel stages={funnelStages} topNote={f.notes.topOfFunnel} />
        ) : analyticsRefused ? null : (
          <Unavailable label="قمع التحويل" reason="تعذّر جلب واجهة /analytics/funnel" />
        )}
      </section>

      {/* ── 3) Projects ───────────────────────────────────────────────────── */}
      <section aria-labelledby="proj-h">
        <h2 id="proj-h" className={H2}>
          المشاريع
        </h2>
        {p ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
                <p className="text-xs text-[#8b949e]">معدّل النجاح</p>
                <p
                  className={`mt-1 text-4xl font-bold tabular-nums ${intentText(
                    pctIntent(p.successRatePct, 'higher'),
                  )}`}
                >
                  {p.successRatePct === null ? 'غير متاح' : fmtPct(p.successRatePct)}
                </p>
                <p className="mt-1 text-[11px] text-[#484f58]">
                  {arInt(p.wonCount)} ناجح ÷ {arInt(p.concludedCount)} منتهٍ
                </p>
              </div>
              <StatTile label="إجمالي المشاريع" value={arInt(p.totalProjects)} />
              <StatTile label="ناجحة" value={arInt(p.wonCount)} intent="ok" />
              <StatTile label="مخفقة" value={arInt(p.lostCount)} intent={p.lostCount > 0 ? 'danger' : 'default'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DistributionBars
                title="توزيع الحالات"
                rows={Object.entries(p.statusDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => ({
                    label: labelOf(PROJECT_STATUS_AR, k),
                    value: v,
                    valueLabel: arInt(v),
                    intent: statusIntent(k) as Intent,
                  }))}
              />
              <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
                <p className="mb-3 text-xs font-bold text-[#8b949e]">المتعهَّد مقابل المحقَّق</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#8b949e]">المتعهَّد</span>
                    <span className="font-bold tabular-nums">{formatSar(p.pledgedVsRealized.pledgedHalalas)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#8b949e]">المحقَّق</span>
                    <span className="font-bold tabular-nums">{formatSar(p.pledgedVsRealized.realizedHalalas)}</span>
                  </div>
                  <div className="border-t border-[#21262d] pt-3">
                    <Bar
                      label="نسبة التحقّق"
                      value={p.pledgedVsRealized.realizationRatePct ?? 0}
                      max={100}
                      intent={pctIntent(p.pledgedVsRealized.realizationRatePct, 'higher')}
                      valueLabel={
                        p.pledgedVsRealized.realizationRatePct === null
                          ? 'غير متاح'
                          : fmtPct(p.pledgedVsRealized.realizationRatePct)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-[#8b949e]">أداء الفئات</p>
              <CategoryTable rows={categoryRows} />
            </div>
          </div>
        ) : analyticsRefused ? null : (
          <Unavailable label="المشاريع" reason="تعذّر جلب واجهة /analytics/projects" />
        )}
      </section>

      {/* ── 4) Users ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="users-h">
        <h2 id="users-h" className={H2}>
          المستخدمون
        </h2>
        {u ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
                <p className="text-xs text-[#8b949e]">تحويل التوثيق (KYC)</p>
                <p
                  className={`mt-1 text-3xl font-bold tabular-nums ${intentText(
                    pctIntent(u.kyc.conversionPct, 'higher'),
                  )}`}
                >
                  {u.kyc.conversionPct === null ? 'غير متاح' : fmtPct(u.kyc.conversionPct)}
                </p>
                <p className="mt-1 text-[11px] text-[#484f58]">
                  {arInt(u.kyc.nafathVerified)} موثّق ÷ {arInt(u.kyc.total)}
                </p>
              </div>
              <StatTile label="إجمالي المستخدمين" value={arInt(u.totalUsers)} hint={`${arInt(u.newUsersInWindow)} جديد ضمن النطاق`} />
              <StatTile label="داعمون فريدون" value={arInt(u.distinctBackers)} hint={`${arInt(u.distinctBackersInWindow)} ضمن النطاق`} />
              <StatTile label="جلسات نشطة" value={arInt(u.activeSessionCount)} />
              <StatTile label="موقوفون" value={arInt(u.suspendedCount)} intent={u.suspendedCount > 0 ? 'warn' : 'default'} />
              <StatTile label="محظورون" value={arInt(u.bannedCount)} intent={u.bannedCount > 0 ? 'danger' : 'default'} />
            </div>
            <DistributionBars
              title="توزيع مراتب السمعة"
              rows={Object.entries(u.reputationTiers)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => ({
                  label: labelOf(REP_TIER_AR, k),
                  value: v,
                  valueLabel: arInt(v),
                }))}
              emptyAr="لا مراتب سمعة"
            />
          </div>
        ) : analyticsRefused ? null : (
          <Unavailable label="المستخدمون" reason="تعذّر جلب واجهة /analytics/users" />
        )}
      </section>

      {/* ── 5) Operations ─────────────────────────────────────────────────── */}
      <section aria-labelledby="ops-h">
        <h2 id="ops-h" className={H2}>
          التشغيل
        </h2>
        {o ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <PctMetric
                label="فشل السحب"
                pct={pickPct(o.captureFailure, ['trueRatePct', 'ratePct', 'pct'])}
                direction="lower"
                reason="لم تُرجِع الواجهة نسبة فشل السحب"
              />
              <PctMetric
                label="معدّل الاسترداد"
                pct={pickPct(o.refundRate, ['ratePct', 'trueRatePct', 'refundRatePct', 'pct'])}
                direction="lower"
                reason="لم تُرجِع الواجهة معدّل الاسترداد"
              />
              <PctMetric
                label="معدّل النزاعات"
                pct={pickPct(o.disputeRate, ['ratePct', 'trueRatePct', 'disputeRatePct', 'pct'])}
                direction="lower"
                reason="لم تُرجِع الواجهة معدّل النزاعات"
              />
              <PctMetric
                label="إنتاجية الإشراف — المشاريع"
                pct={o.moderation.projectThroughputPct}
                direction="higher"
                reason="لم تُرجِع الواجهة نسبة إنتاجية الإشراف"
              />
              <PctMetric
                label="إنتاجية الإشراف — التعليقات"
                pct={o.moderation.commentThroughputPct ?? null}
                direction="higher"
                reason="لم تُرجِع الواجهة نسبة إنتاجية إشراف التعليقات"
              />
              <PctMetric
                label="نجاح الصرف"
                pct={pickPct(o.payoutSuccess, ['successRatePct', 'ratePct', 'pct'])}
                direction="higher"
                reason="لم تُرجِع الواجهة معدّل نجاح الصرف"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
                <p className="mb-3 text-xs font-bold text-[#8b949e]">الإشراف على البلاغات</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCell label="بلاغات مشاريع مفتوحة" value={arInt(o.moderation.projectReportsOpened)} />
                  <MetricCell label="بلاغات مشاريع محلولة" value={arInt(o.moderation.projectReportsResolved)} />
                  <MetricCell label="بلاغات تعليقات مفتوحة" value={arInt(o.moderation.commentReportsOpened)} />
                  {o.moderation.commentReportsResolved === null ? (
                    <MetricCell
                      label="بلاغات تعليقات محلولة"
                      value={
                        <span title="لم تُرجِع الواجهة هذا العدّاد" className="text-sm text-[#484f58]">
                          غير متاح
                        </span>
                      }
                      hint="لم تُرجِع الواجهة هذا العدّاد"
                    />
                  ) : (
                    <MetricCell label="بلاغات تعليقات محلولة" value={arInt(o.moderation.commentReportsResolved)} />
                  )}
                </div>
              </div>

              <DistributionBars
                title="تذاكر الدعم حسب الحالة"
                rows={Object.entries(o.supportTicketsByStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => ({
                    label: labelOf(TICKET_STATUS_AR, k),
                    value: v,
                    valueLabel: arInt(v),
                    intent: (k === 'OPEN' || k === 'PENDING' ? 'warn' : 'default') as Intent,
                  }))}
                emptyAr="لا تذاكر دعم"
              />
            </div>
          </div>
        ) : analyticsRefused ? null : (
          <Unavailable label="التشغيل" reason="تعذّر جلب واجهة /analytics/operations" />
        )}
      </section>
    </div>
  );
}
