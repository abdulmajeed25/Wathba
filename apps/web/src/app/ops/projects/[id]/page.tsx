import Link from 'next/link';

import { StatusBadge } from '../../_components/badge';
import { OpRunner } from '../../_components/op-runner';
import { API_BASE, requireAdmin, requireOpsSession } from '../../_lib/guard';
import { formatSar } from '../../_lib/money';
import { PartnerRunner } from '../_components/partner-runner';
import { statusIntent, statusLabel } from '../_components/status';

/**
 * OPS Phase 2 — the per-project WORKSPACE. Server-first. Fetches the detail
 * read + the audit entity trail in parallel, then renders tabs (server, via
 * ?tab=) over overview / milestones+payouts / recent backers (masked) /
 * timeline / operations. The operations panel exposes ONLY the OpRunners
 * whose preconditions plausibly hold for the current status/visibility.
 */

interface Milestone {
  id: string;
  order: number;
  titleAr: string;
  releasePct: number;
  status: string;
  releasedHalalas: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
}
interface PayoutSummary {
  status: string;
  count: number;
  grossHalalas: string;
  netHalalas: string;
}
interface RecentPledge {
  id: string;
  backer: { id: string; name: string | null; email: string };
  amountHalalas: string | null;
  addOnsHalalas: string | null;
  status: string;
  createdAt: string;
}
interface ProjectDetail {
  id: string;
  titleAr: string;
  shortDescAr: string | null;
  status: string;
  categoryId: string | null;
  categoryNameAr: string | null;
  region: string | null;
  goalHalalas: string | null;
  raisedHalalas: string | null;
  realizedHalalas: string | null;
  backersCount: number;
  releaseThresholdPct: number | null;
  deadline: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  reviewFeedback: string | null;
  hiddenAt: string | null;
  hiddenReasonAr: string | null;
  isStaffPick: boolean;
  createdAt: string;
  createdBy: { id: string; handle: string | null; name: string | null };
  milestones: Milestone[];
  payoutSummary: PayoutSummary[];
  recentPledges: RecentPledge[];
  openReportCount: number;
}
interface AuditRow {
  id: string;
  chainSeq: string;
  actorType: string;
  actorId: string | null;
  action: string;
  riskTier: string | null;
  reason: string | null;
  createdAt: string;
}

const TABS: Array<{ key: string; labelAr: string }> = [
  { key: 'overview', labelAr: 'نظرة عامة' },
  { key: 'milestones', labelAr: 'المراحل والصرف' },
  { key: 'backers', labelAr: 'الداعمون' },
  { key: 'timeline', labelAr: 'الخط الزمني' },
  { key: 'operations', labelAr: 'العمليات' },
];

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function Figure({ labelAr, value, muted = false }: { labelAr: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2.5">
      <dt className="text-xs text-[#8b949e]">{labelAr}</dt>
      <dd className={`mt-0.5 text-base font-bold tabular-nums ${muted ? 'text-[#8b949e]' : ''}`}>{value}</dd>
    </div>
  );
}

export default async function OpsProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : 'overview';

  let detail: ProjectDetail | null = null;
  let trail: AuditRow[] = [];
  let refused = false;
  let notFound = false;

  try {
    const [dRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/projects/${id}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/v1/ops/audit/entity/Project/${id}?limit=100`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
    ]);
    if (dRes.status === 403) refused = true;
    if (dRes.status === 404) notFound = true;
    if (dRes.ok) detail = (await dRes.json()) as ProjectDetail;
    if (aRes.ok) trail = ((await aRes.json()) as { items: AuditRow[] }).items;
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  const back = (
    <Link href="/ops/projects" className="text-sm text-[#58a6ff] hover:underline">
      ← كل المشاريع
    </Link>
  );

  if (refused) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">المشروع</h1>
          {back}
        </div>
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية projects.review — اطلب دور REVIEWER أو أعلى من المالك.
        </p>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">المشروع</h1>
          {back}
        </div>
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          {notFound ? 'المشروع غير موجود.' : 'تعذّر تحميل المشروع (الخادم غير متاح).'}
        </p>
      </div>
    );
  }

  const d = detail;
  const hidden = !!d.hiddenAt;
  const tabHref = (t: string) => `/ops/projects/${id}${t === 'overview' ? '' : `?tab=${t}`}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold">{d.titleAr}</h1>
            <StatusBadge intent={statusIntent(d.status)}>{statusLabel(d.status)}</StatusBadge>
            {d.isStaffPick ? <StatusBadge intent="ok">مختارات وثبة</StatusBadge> : null}
            {hidden ? <StatusBadge intent="danger">مخفي</StatusBadge> : null}
            {d.openReportCount > 0 ? (
              <StatusBadge intent="warn">{d.openReportCount} بلاغ مفتوح</StatusBadge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[#8b949e]">
            {d.categoryNameAr ?? 'بلا فئة'} ·{' '}
            <span dir="ltr" className="font-mono text-xs">
              @{d.createdBy.handle ?? d.createdBy.id.slice(0, 8)}
            </span>{' '}
            · <Link href={`/projects/${d.id}`} className="text-[#58a6ff] hover:underline">الصفحة العامة ↗</Link>
          </p>
        </div>
        {back}
      </div>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-[#21262d]" aria-label="أقسام المشروع">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`rounded-t border-b-2 px-3 py-2 text-sm ${
              tab === t.key
                ? 'border-[#f78166] font-bold text-[#e6edf3]'
                : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'
            }`}
          >
            {t.labelAr}
          </Link>
        ))}
      </nav>

      {tab === 'overview' ? (
        <section className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure labelAr="الهدف" value={formatSar(d.goalHalalas)} />
            <Figure labelAr="المتعهَّد به (raised)" value={formatSar(d.raisedHalalas)} />
            <Figure labelAr="المحقَّق (realized)" value={formatSar(d.realizedHalalas)} />
            <Figure labelAr="عدد الداعمين" value={d.backersCount.toLocaleString('ar-SA')} muted />
          </dl>
          <p className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-xs text-[#8b949e]">
            «المتعهَّد به» هو مجموع الحجوزات، و«المحقَّق» هو ما قُطف فعلاً بعد التسوية — الرسوم تُقتطع
            عند الصرف لكل مرحلة (صافي/إجمالي أدناه في تبويب المراحل والصرف). العتبة:{' '}
            {d.releaseThresholdPct != null ? `${d.releaseThresholdPct}%` : '—'} · الموعد:{' '}
            {fmtDate(d.deadline)}
          </p>
          {d.shortDescAr ? (
            <p className="text-sm text-[#8b949e]">{d.shortDescAr}</p>
          ) : null}
          {hidden && d.hiddenReasonAr ? (
            <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              مخفي — السبب: {d.hiddenReasonAr}
            </p>
          ) : null}
          {d.reviewFeedback ? (
            <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
              آخر ملاحظات مراجعة: {d.reviewFeedback}
            </p>
          ) : null}
        </section>
      ) : null}

      {tab === 'milestones' ? (
        <section className="space-y-5">
          <div className="overflow-x-auto rounded-lg border border-[#21262d]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#161b22] text-right text-[#8b949e]">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">المرحلة</th>
                  <th className="px-3 py-2 font-medium">النسبة</th>
                  <th className="px-3 py-2 font-medium">الحالة</th>
                  <th className="px-3 py-2 font-medium">المصروف</th>
                  <th className="px-3 py-2 font-medium">التواريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
                {d.milestones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[#8b949e]">
                      لا مراحل معرّفة
                    </td>
                  </tr>
                ) : (
                  d.milestones.map((m) => (
                    <tr key={m.id} className="align-top">
                      <td className="px-3 py-2 tabular-nums text-[#8b949e]">{m.order}</td>
                      <td className="px-3 py-2">{m.titleAr}</td>
                      <td className="px-3 py-2 tabular-nums">{m.releasePct}%</td>
                      <td className="px-3 py-2">
                        <StatusBadge intent="info">{m.status}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatSar(m.releasedHalalas)}</td>
                      <td className="px-3 py-2 text-xs text-[#8b949e]">
                        {m.releasedAt
                          ? `صُرف ${fmtDate(m.releasedAt)}`
                          : m.approvedAt
                            ? `اعتُمد ${fmtDate(m.approvedAt)}`
                            : m.submittedAt
                              ? `قُدّم ${fmtDate(m.submittedAt)}`
                              : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-2 text-base font-bold">ملخّص الصرف (إجمالي / صافي بعد الرسوم)</h2>
            <div className="overflow-x-auto rounded-lg border border-[#21262d]">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-[#161b22] text-right text-[#8b949e]">
                  <tr>
                    <th className="px-3 py-2 font-medium">الحالة</th>
                    <th className="px-3 py-2 font-medium">العدد</th>
                    <th className="px-3 py-2 font-medium">الإجمالي</th>
                    <th className="px-3 py-2 font-medium">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
                  {d.payoutSummary.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-[#8b949e]">
                        لا صرفيات بعد
                      </td>
                    </tr>
                  ) : (
                    d.payoutSummary.map((p) => (
                      <tr key={p.status}>
                        <td className="px-3 py-2">
                          <StatusBadge intent="muted">{p.status}</StatusBadge>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{p.count.toLocaleString('ar-SA')}</td>
                        <td className="px-3 py-2 tabular-nums">{formatSar(p.grossHalalas)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatSar(p.netHalalas)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'backers' ? (
        <section>
          <p className="mb-2 text-xs text-[#8b949e]">
            آخر ٢٠ تعهّداً — البريد مُقنَّع (لا PII خام على هذه الواجهة).
          </p>
          <div className="overflow-x-auto rounded-lg border border-[#21262d]">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[#161b22] text-right text-[#8b949e]">
                <tr>
                  <th className="px-3 py-2 font-medium">الداعم</th>
                  <th className="px-3 py-2 font-medium">المبلغ</th>
                  <th className="px-3 py-2 font-medium">الإضافات</th>
                  <th className="px-3 py-2 font-medium">الحالة</th>
                  <th className="px-3 py-2 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
                {d.recentPledges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[#8b949e]">
                      لا تعهّدات بعد
                    </td>
                  </tr>
                ) : (
                  d.recentPledges.map((pl) => (
                    <tr key={pl.id} className="align-top">
                      <td className="px-3 py-2">
                        <span>{pl.backer.name ?? '—'}</span>
                        <span className="block font-mono text-[11px] text-[#8b949e]" dir="ltr">
                          {pl.backer.email}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatSar(pl.amountHalalas)}</td>
                      <td className="px-3 py-2 tabular-nums text-[#8b949e]">
                        {formatSar(pl.addOnsHalalas)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge intent="muted">{pl.status}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#8b949e]">{fmtDate(pl.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'timeline' ? (
        <section>
          <p className="mb-3 text-xs text-[#8b949e]">
            كل عملية محكومة لمست هذا المشروع — من سجل التدقيق غير القابل للتعديل.{' '}
            <Link
              href={`/ops/audit?entity=Project&entityId=${d.id}`}
              className="text-[#58a6ff] hover:underline"
            >
              فتح في سجل التدقيق ←
            </Link>
          </p>
          {trail.length === 0 ? (
            <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-6 text-center text-sm text-[#8b949e]">
              لا قيود تدقيق لهذا المشروع بعد
            </p>
          ) : (
            <ol className="space-y-2">
              {trail.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm"
                >
                  <span className="tabular-nums text-[#484f58]">#{r.chainSeq}</span>
                  <span className="whitespace-nowrap text-xs text-[#8b949e]">
                    {fmtDate(r.createdAt)}
                  </span>
                  <code className="font-mono text-xs text-[#e6edf3]">{r.action}</code>
                  {r.riskTier ? <StatusBadge intent="muted">{r.riskTier}</StatusBadge> : null}
                  <span className="text-xs text-[#8b949e]">{r.actorType}</span>
                  {r.reason ? (
                    <span className="basis-full text-xs text-[#8b949e]">— {r.reason}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {tab === 'operations' ? (
        <section className="space-y-4">
          <p className="text-xs text-[#8b949e]">
            العمليات المتاحة تبعاً للحالة الحالية ({statusLabel(d.status)}). كلٌّ منها يمرّ بالمعاينة
            (dry-run) قبل التنفيذ، ويُسجَّل في التدقيق. تُعرض فقط العمليات التي تُحقَّق شروطها المبدئية
            هنا.
          </p>

          {/* Review decisions — only under review */}
          {d.status === 'UNDER_REVIEW' ? (
            <div className="flex flex-wrap gap-2 rounded border border-[#30363d] bg-[#0d1117] p-3">
              <span className="w-full text-sm font-bold">قرار المراجعة</span>
              <OpRunner
                opKey="projects.review.approve"
                input={{ projectId: d.id }}
                triggerLabel="اعتماد"
                variant="primary"
                requiresReason={false}
                riskTier="STANDARD"
              />
              <OpRunner
                opKey="projects.review.reject"
                input={{ projectId: d.id }}
                triggerLabel="رفض (مع ملاحظات)"
                variant="danger"
                requiresReason
                riskTier="STANDARD"
              />
            </div>
          ) : null}

          {/* Curation */}
          <div className="flex flex-wrap items-center gap-2 rounded border border-[#30363d] bg-[#0d1117] p-3">
            <span className="w-full text-sm font-bold">التمييز والتنسيق</span>
            <OpRunner
              opKey="projects.staff-pick.set"
              input={{ projectId: d.id, value: !d.isStaffPick }}
              triggerLabel={d.isStaffPick ? 'إزالة من مختارات وثبة' : 'تمييز ضمن مختارات وثبة'}
              variant="ghost"
              requiresReason={false}
              riskTier="STANDARD"
            />
          </div>

          <PartnerRunner projectId={d.id} />

          {/* Visibility */}
          <div className="flex flex-wrap items-center gap-2 rounded border border-[#30363d] bg-[#0d1117] p-3">
            <span className="w-full text-sm font-bold">الظهور</span>
            {hidden ? (
              <OpRunner
                opKey="moderation.project.unhide"
                input={{ projectId: d.id }}
                triggerLabel="إعادة الإظهار"
                variant="ghost"
                requiresReason={false}
                riskTier="STANDARD"
              />
            ) : (
              <OpRunner
                opKey="moderation.project.hide"
                input={{ projectId: d.id }}
                triggerLabel="إخفاء من القراءات العامة"
                variant="danger"
                requiresReason
                riskTier="STANDARD"
              />
            )}
          </div>

          {/* Lifecycle — pause/unpause/force-close */}
          <div className="flex flex-wrap items-center gap-2 rounded border border-[#30363d] bg-[#0d1117] p-3">
            <span className="w-full text-sm font-bold">دورة الحياة</span>
            {d.status === 'LIVE' ? (
              <OpRunner
                opKey="projects.pause.admin"
                input={{ projectId: d.id }}
                triggerLabel="إيقاف مؤقت (إداري)"
                variant="ghost"
                requiresReason={false}
                riskTier="STANDARD"
              />
            ) : null}
            {d.status === 'PAUSED' ? (
              <OpRunner
                opKey="projects.unpause.admin"
                input={{ projectId: d.id }}
                triggerLabel="استئناف (إداري)"
                variant="ghost"
                requiresReason={false}
                riskTier="STANDARD"
              />
            ) : null}
            {['UNDER_REVIEW', 'SCHEDULED', 'LIVE', 'PAUSED'].includes(d.status) ? (
              <OpRunner
                opKey="projects.force-close"
                input={{ projectId: d.id }}
                triggerLabel="إغلاق قسري"
                variant="danger"
                requiresReason
                riskTier="SENSITIVE"
              />
            ) : (
              <span className="text-xs text-[#484f58]">
                لا إجراءات دورة حياة متاحة لهذه الحالة
              </span>
            )}
          </div>

          {/* Money — settle + counters */}
          <div className="flex flex-wrap items-center gap-2 rounded border border-red-500/30 bg-red-500/5 p-3">
            <span className="w-full text-sm font-bold text-red-200">المال (تنفيذ محكوم — تأكيد مطلوب)</span>
            {['LIVE', 'PAUSED'].includes(d.status) ? (
              <OpRunner
                opKey="money.settle.run"
                input={{ projectId: d.id }}
                triggerLabel="تشغيل التسوية"
                variant="danger"
                requiresReason
                riskTier="MONEY"
              />
            ) : null}
            {d.status !== 'DRAFT' ? (
              <OpRunner
                opKey="money.counters.recompute"
                input={{ projectId: d.id }}
                triggerLabel="إعادة حساب العدّادات"
                variant="ghost"
                requiresReason
                riskTier="SENSITIVE"
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
