import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';

/**
 * OPS Part 3 — «سجل التدقيق»: the audit browser. Server-first (zero client
 * JS): filters are a plain GET form, pagination is a cursor link, and the
 * chain-verification verdict renders as a banner. Permission: audit.read
 * (the API refuses otherwise; the page surfaces that refusal honestly).
 */

interface AuditRow {
  id: string;
  chainSeq: string;
  actorId: string | null;
  actorType: string;
  action: string;
  entity: string;
  entityId: string | null;
  riskTier: string | null;
  reason: string | null;
  ip: string | null;
  createdAt: string;
  hash: string;
  prevHash: string;
}

interface Verdict {
  ok: boolean;
  checked: number;
  brokenAtSeq: string | null;
  verifiedAt: string;
}

const TIER_STYLE: Record<string, string> = {
  MONEY: 'border-red-500/40 bg-red-500/10 text-red-300',
  SENSITIVE: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  STANDARD: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  CONTENT: 'border-[#30363d] bg-[#161b22] text-[#8b949e]',
};

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
}

export default async function OpsAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const filters = {
    q: sp.q,
    action: sp.action,
    entity: sp.entity,
    entityId: sp.entityId,
    actorType: sp.actorType,
    riskTier: sp.riskTier,
    from: sp.from,
    to: sp.to,
  };

  let rows: AuditRow[] = [];
  let nextCursor: string | null = null;
  let verdict: Verdict | null = null;
  let refused = false;

  try {
    const [listRes, verifyRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/audit${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/v1/ops/audit/verify`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
    ]);
    if (listRes.status === 403) refused = true;
    if (listRes.ok) {
      const body = (await listRes.json()) as { items: AuditRow[]; nextCursor: string | null };
      rows = body.items;
      nextCursor = body.nextCursor;
    }
    if (verifyRes.ok) verdict = (await verifyRes.json()) as Verdict;
  } catch {
    /* API unreachable — the page renders the empty/refused states below */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">سجل التدقيق</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            كل عملية، كل دخول، كل كشف بيانات — سلسلة هاش لا تقبل التعديل ولا الحذف
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {verdict ? (
        verdict.ok ? (
          <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
            ✓ السلسلة سليمة — {verdict.checked.toLocaleString('ar-SA-u-nu-latn')} قيداً أُعيد حسابها الآن بلا
            كسر
          </p>
        ) : (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300">
            ✗ السلسلة مكسورة عند القيد {verdict.brokenAtSeq} — السجل عُدِّل خارج القناة. تعامل معها
            كحادثة أمنية فوراً.
          </p>
        )
      ) : null}

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية audit.read — اطلب دور ANALYST أو أعلى من المالك.
        </p>
      ) : null}

      <form method="get" className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-3 lg:grid-cols-4">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="بحث حر (الإجراء/الكيان/السبب)"
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        />
        <input
          name="action"
          defaultValue={sp.action ?? ''}
          placeholder="الإجراء (مثل ops.money)"
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        />
        <input
          name="entity"
          defaultValue={sp.entity ?? ''}
          placeholder="الكيان (Project, User, …)"
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        />
        <select
          name="riskTier"
          defaultValue={sp.riskTier ?? ''}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        >
          <option value="">كل المستويات</option>
          <option value="MONEY">MONEY</option>
          <option value="SENSITIVE">SENSITIVE</option>
          <option value="STANDARD">STANDARD</option>
          <option value="CONTENT">CONTENT</option>
        </select>
        <select
          name="actorType"
          defaultValue={sp.actorType ?? ''}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        >
          <option value="">كل الفاعلين</option>
          <option value="HUMAN">بشري</option>
          <option value="AGENT">وكيل</option>
          <option value="SYSTEM">النظام</option>
        </select>
        <input
          name="from"
          type="date"
          defaultValue={sp.from ?? ''}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        />
        <input
          name="to"
          type="date"
          defaultValue={sp.to ?? ''}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-[#238636] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2ea043]"
        >
          تصفية
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">الوقت</th>
              <th className="px-3 py-2 font-medium">الإجراء</th>
              <th className="px-3 py-2 font-medium">الكيان</th>
              <th className="px-3 py-2 font-medium">الفاعل</th>
              <th className="px-3 py-2 font-medium">المستوى</th>
              <th className="px-3 py-2 font-medium">السبب</th>
              <th className="px-3 py-2 font-medium">الهاش</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[#8b949e]">
                  لا قيود مطابقة للمرشحات
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2 tabular-nums text-[#8b949e]">{r.chainSeq}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[#8b949e]">
                    {new Date(r.createdAt).toLocaleString('ar-SA-u-nu-latn', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2">
                    {r.entity}
                    {r.entityId ? (
                      <span className="block font-mono text-[11px] text-[#8b949e]">
                        {r.entityId.slice(0, 8)}…
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs">{r.actorType}</span>
                    {r.actorId ? (
                      <span className="block font-mono text-[11px] text-[#8b949e]">
                        {r.actorId.slice(0, 8)}…
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {r.riskTier ? (
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[11px] ${TIER_STYLE[r.riskTier] ?? TIER_STYLE.CONTENT}`}
                      >
                        {r.riskTier}
                      </span>
                    ) : (
                      <span className="text-[#484f58]">—</span>
                    )}
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-[#8b949e]">
                    {r.reason ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[#484f58]" title={r.hash}>
                    {r.hash.slice(0, 10)}…
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nextCursor ? (
        <div className="text-center">
          <Link
            href={`/ops/audit${qs({ ...filters, cursor: nextCursor })}`}
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            الأقدم ↓
          </Link>
        </div>
      ) : null}
    </div>
  );
}
