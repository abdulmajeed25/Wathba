import Link from 'next/link';

import { RiskTierBadge, StatusBadge } from '../../../_components/badge';
import { OpRunner } from '../../../_components/op-runner';
import { API_BASE, requireAdmin, requireOpsSession } from '../../../_lib/guard';
import { SupplierBidsTable, type SupplierBidRow } from './bids-table';

/**
 * OPS-360 Unit 3 — the missing supplier ENTITY profile.
 *
 * `/ops/suppliers/[id]` is RFQ detail; this route is the supplier RECORD:
 * GET /v1/ops/suppliers/:userId (masked user + bids across every RFQ +
 * verification status + won/lost tally) joined with the entity audit trail
 * (GET /v1/ops/audit/entity/User/:userId) and the suppliers.verify OpRunner.
 * Server-first; PII arrives masked from the API. Linked from the verification
 * queue rows on /ops/suppliers.
 */

interface SupplierProfile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  handle: string | null;
  city: string | null;
  roles: string[];
  isSupplier: boolean;
  verification: {
    verified: boolean;
    verifiedAt: string | null;
    verifiedById: string | null;
    note: string | null;
  };
  bidCounts: Record<string, number>;
  wonCount: number;
  lostCount: number;
  bids: SupplierBidRow[];
  createdAt: string | null;
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

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function Figure({ labelAr, value, muted = false }: { labelAr: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2.5">
      <dt className="text-xs text-[#8b949e]">{labelAr}</dt>
      <dd className={`mt-0.5 text-base font-bold tabular-nums ${muted ? 'text-[#8b949e]' : ''}`}>{value}</dd>
    </div>
  );
}

export default async function OpsSupplierProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const { userId } = await params;

  let profile: SupplierProfile | null = null;
  let trail: AuditRow[] = [];
  let refused = false;
  let notFound = false;

  try {
    const [pRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/suppliers/${userId}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/v1/ops/audit/entity/User/${userId}?limit=100`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
    ]);
    if (pRes.status === 403) refused = true;
    if (pRes.status === 404) notFound = true;
    if (pRes.ok) profile = (await pRes.json()) as SupplierProfile;
    // The audit trail is a bonus (needs audit.read) — a 403 there just hides it.
    if (aRes.ok) trail = ((await aRes.json()) as { items: AuditRow[] }).items;
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  const back = (
    <Link href="/ops/suppliers" className="text-sm text-[#58a6ff] hover:underline">
      ← الموردون والمزادات
    </Link>
  );

  if (refused) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">ملف المورّد</h1>
          {back}
        </div>
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية قراءة الموردين — اطلب صلاحية المشتريات أو مدير العمليات.
        </p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">ملف المورّد</h1>
          {back}
        </div>
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          {notFound ? 'المورّد غير موجود.' : 'تعذّر تحميل ملف المورّد (الخادم غير متاح).'}
        </p>
      </div>
    );
  }

  const p = profile;
  const v = p.verification;
  const totalBids = Object.values(p.bidCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold">{p.name ?? 'مورّد بلا اسم'}</h1>
            {v.verified ? (
              <StatusBadge intent="ok">موثَّق</StatusBadge>
            ) : (
              <StatusBadge intent="warn">بانتظار التوثيق</StatusBadge>
            )}
            {p.isSupplier ? null : <StatusBadge intent="danger">ليس مورّداً</StatusBadge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-[#8b949e]">
            {p.handle ? (
              <span dir="ltr" className="font-mono text-xs">
                @{p.handle}
              </span>
            ) : null}
            <span dir="ltr" className="font-mono text-xs">
              {p.email}
            </span>
            {p.phone ? (
              <span dir="ltr" className="font-mono text-xs">
                {p.phone}
              </span>
            ) : null}
            {p.city ? <span>· {p.city}</span> : null}
          </p>
        </div>
        {back}
      </div>

      {/* Verification + verify action */}
      <section className="space-y-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold">التوثيق</h2>
          {!v.verified && p.isSupplier ? (
            <OpRunner
              opKey="suppliers.verify"
              input={{ userId: p.id }}
              triggerLabel="توثيق المورّد"
              variant="primary"
              requiresReason={false}
              riskTier="STANDARD"
            />
          ) : null}
        </div>
        <p className="text-sm text-[#8b949e]">
          {v.verified
            ? `موثَّق منذ ${fmtDate(v.verifiedAt)}.`
            : 'لم يُوثَّق هذا المورّد بعد — التوثيق عملية محكومة تُسجَّل في التدقيق.'}
        </p>
        {v.note ? (
          <p className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#8b949e]">
            ملاحظة التوثيق: {v.note}
          </p>
        ) : null}
      </section>

      {/* Bid tally */}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure labelAr="إجمالي العروض" value={totalBids.toLocaleString('ar-SA-u-nu-latn')} muted />
        <Figure labelAr="عروض فائزة" value={p.wonCount.toLocaleString('ar-SA-u-nu-latn')} />
        <Figure labelAr="عروض مرفوضة" value={p.lostCount.toLocaleString('ar-SA-u-nu-latn')} muted />
        <Figure labelAr="عضو منذ" value={fmtDate(p.createdAt)} muted />
      </dl>

      {Object.keys(p.bidCounts).length ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(p.bidCounts).map(([status, count]) => (
            <span
              key={status}
              className="rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1 text-xs text-[#8b949e]"
            >
              {status}: <b className="tabular-nums text-[#e6edf3]">{count.toLocaleString('ar-SA-u-nu-latn')}</b>
            </span>
          ))}
        </div>
      ) : null}

      {/* Bids across every RFQ */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">العروض عبر طلبات عروض الأسعار</h2>
        <SupplierBidsTable rows={p.bids} />
      </section>

      {/* Audit trail for this User entity */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">الخط الزمني</h2>
          <Link
            href={`/ops/audit?entity=User&entityId=${p.id}`}
            className="text-sm text-[#58a6ff] hover:underline"
          >
            فتح في سجل التدقيق ←
          </Link>
        </div>
        {trail.length === 0 ? (
          <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-6 text-center text-sm text-[#8b949e]">
            لا قيود تدقيق لهذا المورّد بعد (أو تفتقد صلاحية audit.read).
          </p>
        ) : (
          <ol className="space-y-2">
            {trail.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm"
              >
                <span className="tabular-nums text-[#484f58]">#{r.chainSeq}</span>
                <span className="whitespace-nowrap text-xs text-[#8b949e]">{fmtDate(r.createdAt)}</span>
                <code className="font-mono text-xs text-[#e6edf3]">{r.action}</code>
                <RiskTierBadge tier={r.riskTier} />
                <span className="text-xs text-[#8b949e]">{r.actorType}</span>
                {r.reason ? <span className="basis-full text-xs text-[#8b949e]">— {r.reason}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
