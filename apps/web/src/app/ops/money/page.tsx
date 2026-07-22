import Link from 'next/link';

import { requireAdmin, requireOpsSession, API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { formatSar, isNonZeroHalalas } from '../_lib/money';
import { StatTile } from '../_components/stat-tile';
import { StatusBadge } from '../_components/badge';
import { PayoutsPanel } from './payouts-panel';
import { RefundsPanel } from './refunds-panel';
import { LedgerBrowser } from './ledger-browser';
import { ReconciliationPanel } from './reconciliation-panel';
import { MilestonesPanel } from './milestones-panel';

/**
 * OPS-PRO Part 5 §4 — «الخزنة» (the vault). The crown screen, built LAST so
 * every guardrail exists before a payout button does: every action here is a
 * MONEY/SENSITIVE registry op run through <OpRunner>, which enforces step-up,
 * four-eyes queueing, a written reason, a typed «نعم» confirmation, and an
 * idempotency key. Nothing on this screen mutates the DB directly.
 */

export const dynamic = 'force-dynamic';

type Tab = 'overview' | 'milestones' | 'payouts' | 'refunds' | 'ledger' | 'reconciliation';

const TABS: Array<{ key: Tab; labelAr: string }> = [
  { key: 'overview', labelAr: 'نظرة عامة' },
  { key: 'milestones', labelAr: 'المعالم' },
  { key: 'payouts', labelAr: 'الدفعات' },
  { key: 'refunds', labelAr: 'الاستردادات' },
  { key: 'ledger', labelAr: 'دفتر الأستاذ' },
  { key: 'reconciliation', labelAr: 'المطابقة' },
];

interface DashboardPayload {
  workQueue?: {
    milestonesSubmitted?: number;
    payoutsPending?: number;
    payoutsFailed?: number;
    pledgesCaptureGrace?: number;
    pledgesFailedCapture?: number;
  };
  vitals?: {
    gmvHalalas?: string;
    pendingPayoutLiabilityHalalas?: string;
    refundCount?: number;
  };
}

async function opsGet<T>(path: string, opsToken: string): Promise<{ ok: boolean; refused: boolean; data: T | null }> {
  try {
    const res = await fetch(`${API_BASE}/v1/ops/${path}`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (res.status === 403) return { ok: false, refused: true, data: null };
    if (!res.ok) return { ok: false, refused: false, data: null };
    return { ok: true, refused: false, data: (await res.json()) as T };
  } catch {
    return { ok: false, refused: false, data: null };
  }
}

export default async function MoneyVaultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken, info } = await requireOpsSession();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? 'overview') as Tab;

  const dash = await opsGet<DashboardPayload>('dashboard', opsToken);

  if (dash.refused) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> أو <code dir="ltr">analytics.read</code> — اطلب دور FINANCE أو أعلى لعرض الخزنة.
      </div>
    );
  }

  const wq = dash.data?.workQueue ?? {};
  const vit = dash.data?.vitals ?? {};

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e6edf3]">الخزنة</h1>
          <p className="text-sm text-[#8b949e]">
            كل إجراء هنا عملية مالية محكومة — تأكيد ثنائي، مصادقة إضافية، وسبب مكتوب. لا شيء يتجاوز السجل.
          </p>
        </div>
        {/* Four-eyes state (Part 2) — read-only, so the operator knows a payout may enter the queue. */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#8b949e]">الرقابة الثنائية على المال:</span>
          <StatusBadge intent={info.roles?.length ? 'info' : 'muted'}>
            {/* fourEyes/moneyAdmins are surfaced by the session endpoint; the team screen renders the authoritative view */}
            مفعّلة حسب عدد مدراء المال
          </StatusBadge>
        </div>
      </header>

      {/* Tab bar (server, via ?tab=) */}
      <nav className="flex flex-wrap gap-1 border-b border-[#21262d]" aria-label="أقسام الخزنة">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/ops/money${qs({ tab: t.key })}`}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'rounded-t-md border border-b-0 border-[#21262d] bg-[#161b22] px-4 py-2 text-sm font-semibold text-[#e6edf3]'
                  : 'px-4 py-2 text-sm text-[#8b949e] hover:text-[#e6edf3]'
              }
            >
              {t.labelAr}
            </Link>
          );
        })}
      </nav>

      {tab === 'overview' && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label="إجمالي المبيعات (GMV)" value={formatSar(vit.gmvHalalas)} />
            <StatTile
              label="التزام الدفعات المعلّقة"
              value={formatSar(vit.pendingPayoutLiabilityHalalas)}
              intent={isNonZeroHalalas(vit.pendingPayoutLiabilityHalalas) ? 'warn' : 'default'}
            />
            <StatTile label="عدد الاستردادات" value={String(vit.refundCount ?? 0)} />
            <StatTile
              label="معالم بانتظار الاعتماد"
              value={String(wq.milestonesSubmitted ?? 0)}
              href="/ops/money?tab=milestones"
              intent={(wq.milestonesSubmitted ?? 0) > 0 ? 'warn' : 'default'}
            />
            <StatTile
              label="دفعات معلّقة / فاشلة"
              value={`${wq.payoutsPending ?? 0} / ${wq.payoutsFailed ?? 0}`}
              href="/ops/money?tab=payouts"
              intent={(wq.payoutsFailed ?? 0) > 0 ? 'danger' : (wq.payoutsPending ?? 0) > 0 ? 'warn' : 'default'}
            />
            <StatTile
              label="التقاطات متعثرة (مهلة/فاشلة)"
              value={`${wq.pledgesCaptureGrace ?? 0} / ${wq.pledgesFailedCapture ?? 0}`}
              href="/ops/money?tab=refunds"
              intent={(wq.pledgesFailedCapture ?? 0) > 0 ? 'danger' : (wq.pledgesCaptureGrace ?? 0) > 0 ? 'warn' : 'default'}
            />
          </div>
          <p className="text-xs text-[#8b949e]">
            الأرقام لقطة حيّة من لوحة القيادة. تفاصيل كل بند في تبويبه. التقارير المالية المفصّلة (العمولة، ضريبة القيمة المضافة،
            صافي الالتزام) مبنية من دفتر الأستاذ والمطابقة أدناه.
          </p>
        </section>
      )}

      {tab === 'milestones' && <MilestonesPanel opsToken={opsToken} />}
      {tab === 'payouts' && <PayoutsPanel opsToken={opsToken} cursor={sp.cursor} status={sp.status} />}
      {tab === 'refunds' && <RefundsPanel opsToken={opsToken} cursor={sp.cursor} status={sp.status} projectId={sp.projectId} />}
      {tab === 'ledger' && (
        <LedgerBrowser opsToken={opsToken} cursor={sp.cursor} entryType={sp.entryType} projectId={sp.projectId} from={sp.from} to={sp.to} />
      )}
      {tab === 'reconciliation' && <ReconciliationPanel opsToken={opsToken} />}
    </div>
  );
}
