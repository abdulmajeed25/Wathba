import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from './_lib/guard';
import { LeaveButton } from './_components/leave-button';
import { StepUpCard } from './_components/step-up-card';
import { TotpCard } from './_components/totp-card';
import { QueueCard } from './_components/queue-card';
import { StatTile } from './_components/stat-tile';
import { formatSar } from './_lib/money';

/**
 * OPS Part 5 — «الرئيسية — مركز القيادة»: the morning board. One server fetch
 * of /v1/ops/dashboard drives two rows — the work queues an operator triages
 * first (each card links to the screen that clears it, coloured red the moment
 * a failure count is non-zero) and the platform vitals (money via formatSar).
 * The separate-session controls (leave / step-up / TOTP) are preserved but
 * demoted below the board — they are hygiene, not the day's work.
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

/** Non-failure queue: neutral until it has any items, then amber. */
const pending = (n: number): 'muted' | 'warn' => (n > 0 ? 'warn' : 'muted');
/** Failure-bearing queue: red the moment a failure count is non-zero. */
const escalate = (failed: number, total: number): 'muted' | 'warn' | 'danger' =>
  failed > 0 ? 'danger' : total > 0 ? 'warn' : 'muted';

const ar = (n: number) => n.toLocaleString('ar-SA');

export default async function OpsHomePage() {
  await requireAdmin();
  const { opsToken, info } = await requireOpsSession();

  let data: Dashboard | null = null;
  let refused = false;
  try {
    const r = await fetch(`${API_BASE}/v1/ops/dashboard`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.status === 403) refused = true;
    if (r.ok) data = (await r.json()) as Dashboard;
  } catch {
    /* API unreachable — the board renders its empty/refused states below. */
  }

  const wq = data?.workQueue;
  const v = data?.vitals;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#21262d] bg-[#161b22] p-5">
        <div>
          <h1 className="text-lg font-bold">الرئيسية — مركز القيادة</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            {info.email} · دخلت {new Date(info.enteredAt).toLocaleTimeString('ar-SA')}
            {data ? (
              <>
                {' '}
                · حُدِّثت {new Date(data.generatedAt).toLocaleTimeString('ar-SA')}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/ops/analytics"
            className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm hover:bg-[#21262d]"
          >
            القياس والتقارير
          </Link>
          <Link
            href="/ops/audit"
            className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm hover:bg-[#21262d]"
          >
            سجل التدقيق
          </Link>
          <LeaveButton />
        </div>
      </section>

      {info.totpPending ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          التحقق الثنائي إلزامي لحسابك ولم يُفعَّل بعد — كل عمليات المال والصلاحيات
          مرفوضة حتى تفعيله في «الجلسة والأمان» أدناه.
        </p>
      ) : null}

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية analytics.read — لوحة القيادة لا تُعرض. اطلب دور ANALYST أو أعلى من
          المالك.
        </p>
      ) : null}

      {!data && !refused ? (
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          تعذّر جلب لوحة القيادة الآن — تحقّق من اتصال واجهة العمليات ثم أعد التحميل.
        </p>
      ) : null}

      {/* ── Work queues: what to triage first ─────────────────────────────── */}
      <section aria-labelledby="queues-h">
        <h2 id="queues-h" className="mb-3 text-base font-bold">
          قوائم العمل
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QueueCard
            title="مشاريع قيد المراجعة"
            count={wq?.projectsUnderReview ?? 0}
            href="/ops/review"
            intent={pending(wq?.projectsUnderReview ?? 0)}
          >
            بانتظار قرار الاعتماد أو الرفض
          </QueueCard>

          <QueueCard
            title="مراحل مُقدَّمة للأدلة"
            count={wq?.milestonesSubmitted ?? 0}
            href="/ops/money"
            intent={pending(wq?.milestonesSubmitted ?? 0)}
          >
            بانتظار مراجعة الأدلة قبل الإفراج
          </QueueCard>

          <QueueCard
            title="مدفوعات مستحقة"
            count={(wq?.payoutsPending ?? 0) + (wq?.payoutsFailed ?? 0)}
            href="/ops/money"
            intent={escalate(wq?.payoutsFailed ?? 0, (wq?.payoutsPending ?? 0) + (wq?.payoutsFailed ?? 0))}
            badgeAr={wq && wq.payoutsFailed > 0 ? 'فشل صرف' : undefined}
          >
            {ar(wq?.payoutsPending ?? 0)} معلّقة ·{' '}
            <span className={wq && wq.payoutsFailed > 0 ? 'font-bold text-red-300' : ''}>
              {ar(wq?.payoutsFailed ?? 0)} فاشلة
            </span>
          </QueueCard>

          <QueueCard
            title="بلاغات مفتوحة"
            count={wq?.reportsOpen ?? 0}
            href="/ops/trust"
            intent={pending(wq?.reportsOpen ?? 0)}
          >
            {ar(wq?.projectReportsOpen ?? 0)} على مشاريع · {ar(wq?.commentReportsOpen ?? 0)} على
            تعليقات
          </QueueCard>

          <QueueCard
            title="تعهدات معرّضة للسحب"
            count={(wq?.pledgesCaptureGrace ?? 0) + (wq?.pledgesFailedCapture ?? 0)}
            href="/ops/money"
            intent={escalate(
              wq?.pledgesFailedCapture ?? 0,
              (wq?.pledgesCaptureGrace ?? 0) + (wq?.pledgesFailedCapture ?? 0),
            )}
            badgeAr={wq && wq.pledgesFailedCapture > 0 ? 'فشل سحب' : undefined}
          >
            {ar(wq?.pledgesCaptureGrace ?? 0)} في مهلة السحب ·{' '}
            <span className={wq && wq.pledgesFailedCapture > 0 ? 'font-bold text-red-300' : ''}>
              {ar(wq?.pledgesFailedCapture ?? 0)} فشل سحبها
            </span>
          </QueueCard>

          <QueueCard
            title="تذاكر دعم مفتوحة"
            count={wq?.ticketsOpen ?? 0}
            href="/ops/support"
            intent={pending(wq?.ticketsOpen ?? 0)}
          >
            بانتظار الإسناد أو الرد
          </QueueCard>
        </div>
      </section>

      {/* ── Platform vitals ───────────────────────────────────────────────── */}
      <section aria-labelledby="vitals-h">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="vitals-h" className="text-base font-bold">
            المؤشرات الحيوية للمنصّة
          </h2>
          <Link href="/ops/analytics" className="text-sm text-[#58a6ff] hover:underline">
            القياس والتقارير ←
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="المبلغ المُجمَّع (مشاريع حيّة)"
            value={formatSar(v?.liveRaisedHalalas)}
            hint="مجموع raisedHalalas للمشاريع الحيّة"
          />
          <StatTile
            label="مشاريع حيّة"
            value={ar(v?.liveCount ?? 0)}
            hint="حالة LIVE"
          />
          <StatTile label="المستخدمون" value={ar(v?.usersCount ?? 0)} hint="إجمالي الحسابات" />
          <StatTile
            label="إجمالي المبيعات (GMV)"
            value={formatSar(v?.gmvHalalas)}
            hint="مجموع realizedHalalas عبر المنصّة"
          />
          <StatTile
            label="التزام المدفوعات المعلّقة"
            value={formatSar(v?.pendingPayoutLiabilityHalalas)}
            hint="الإجمالي المستحق صرفه (payouts PENDING)"
            intent={v && v.pendingPayoutLiabilityHalalas !== '0' ? 'warn' : 'default'}
          />
          <StatTile
            label="التعهدات المستردّة"
            value={ar(v?.refundCount ?? 0)}
            hint="حالة REFUNDED"
            href="/ops/money"
          />
        </div>
      </section>

      {/* ── Quick links ───────────────────────────────────────────────────── */}
      <section aria-labelledby="links-h">
        <h2 id="links-h" className="mb-3 text-base font-bold">
          روابط سريعة
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            { href: '/ops/review', labelAr: 'المراجعة' },
            { href: '/ops/money', labelAr: 'المال' },
            { href: '/ops/trust', labelAr: 'الثقة والأمان' },
            { href: '/ops/support', labelAr: 'الدعم' },
            { href: '/ops/users', labelAr: 'المستخدمون' },
            { href: '/ops/analytics', labelAr: 'التحليلات' },
            { href: '/ops/audit', labelAr: 'سجل التدقيق' },
            { href: '/ops/agents', labelAr: 'الوكلاء' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 hover:bg-[#21262d]"
            >
              {l.labelAr}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Session hygiene (demoted) ─────────────────────────────────────── */}
      <section aria-labelledby="session-h" className="border-t border-[#21262d] pt-6">
        <h2 id="session-h" className="mb-3 text-base font-bold">
          الجلسة والأمان
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <StepUpCard fresh={info.stepUpFresh} stepUpAt={info.stepUpAt} totpEnabled={info.totpEnabled} />
          <TotpCard enabled={info.totpEnabled} required={info.totpRequired} />
        </div>
      </section>
    </div>
  );
}
