import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { FilterForm } from '../_lib/filters';
import { OpRunner } from '../_components/op-runner';
import { StatTile } from '../_components/stat-tile';
import { RfqsTable, type RfqRow } from './rfqs-table';

/**
 * OPS Phase 2 — «الموردون والمزادات». Two oversight surfaces on one screen:
 *  (a) the supplier VERIFICATION QUEUE — SUPPLIER-role users still awaiting
 *      manual verification (supplierVerifiedAt === null) → suppliers.verify.
 *  (b) RFQ / auction OVERSIGHT — every RFQ with its live bid count + status,
 *      each linking to its detail page (bids + rfq.close/cancel/shortlist).
 * Server-first; each section refuses independently (they gate on different
 * permissions: users.lifecycle vs projects.review).
 */

interface UserRow {
  id: string;
  name: string;
  email: string;
  handle: string | null;
  roles: string[];
  supplierVerifiedAt: string | null;
  createdAt: string | null;
}

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
}

export default async function OpsSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  let suppliers: UserRow[] = [];
  let suppliersRefused = false;
  let rfqs: RfqRow[] = [];
  let rfqsRefused = false;
  let rfqCursor: string | null = null;

  try {
    const [usersRes, rfqsRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/users?role=SUPPLIER&limit=100`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(
        `${API_BASE}/v1/ops/procurement/rfqs${qs({ status: sp.status, cursor: sp.cursor, limit: '50' })}`,
        { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
      ),
    ]);
    if (usersRes.status === 403) suppliersRefused = true;
    if (usersRes.ok) {
      const body = (await usersRes.json()) as { items: UserRow[] };
      suppliers = body.items;
    }
    if (rfqsRes.status === 403) rfqsRefused = true;
    if (rfqsRes.ok) {
      const body = (await rfqsRes.json()) as { items: RfqRow[]; nextCursor: string | null };
      rfqs = body.items;
      rfqCursor = body.nextCursor;
    }
  } catch {
    /* API unreachable — the sections render their empty/refused states */
  }

  const unverified = suppliers.filter((s) => s.supplierVerifiedAt === null);
  const verified = suppliers.length - unverified.length;
  const openRfqs = rfqs.filter((r) => r.status === 'OPEN').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الموردون والمزادات</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            توثيق الموردين والإشراف على طلبات عروض الأسعار — القبول والإغلاق والإلغاء عمليات محوكمة
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="موردون بانتظار التوثيق"
          value={unverified.length.toLocaleString('ar-SA')}
          intent={unverified.length > 0 ? 'warn' : 'ok'}
        />
        <StatTile label="موردون موثَّقون" value={verified.toLocaleString('ar-SA')} />
        <StatTile label="طلبات عروض مفتوحة" value={openRfqs.toLocaleString('ar-SA')} />
      </div>

      {/* ── (a) verification queue ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">طابور توثيق الموردين</h2>

        {suppliersRefused ? (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            تفتقد صلاحية users.lifecycle — طابور توثيق الموردين للدعم أو مدير العمليات.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#21262d]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#161b22] text-right text-[#8b949e]">
                <tr>
                  <th className="px-3 py-2 font-medium">المورّد</th>
                  <th className="px-3 py-2 font-medium">البريد (مقنَّع)</th>
                  <th className="px-3 py-2 font-medium">مسجَّل منذ</th>
                  <th className="px-3 py-2 font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
                {unverified.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[#8b949e]">
                      لا موردين بانتظار التوثيق
                    </td>
                  </tr>
                ) : (
                  unverified.map((u) => (
                    <tr key={u.id} className="align-top">
                      <td className="px-3 py-2">
                        {u.name}
                        {u.handle ? (
                          <span className="block font-mono text-[11px] text-[#8b949e]">
                            @{u.handle}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[#8b949e]" dir="ltr">
                        {u.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[#8b949e]">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString('ar-SA', { dateStyle: 'medium' })
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <OpRunner
                          opKey="suppliers.verify"
                          input={{ userId: u.id }}
                          triggerLabel="توثيق المورّد"
                          riskTier="STANDARD"
                          requiresReason={false}
                          variant="primary"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── (b) RFQ / auction oversight ────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">الإشراف على طلبات عروض الأسعار</h2>

        <FilterForm
          fields={[
            {
              kind: 'select',
              name: 'status',
              labelAr: 'الحالة',
              allLabelAr: 'كل الحالات',
              options: [
                { value: 'OPEN', labelAr: 'مفتوح' },
                { value: 'AWARDED', labelAr: 'مُرسى' },
                { value: 'CLOSED', labelAr: 'مغلق' },
                { value: 'CANCELLED', labelAr: 'ملغى' },
              ],
            },
          ]}
          values={sp}
          action="/ops/suppliers"
        />

        {rfqsRefused ? (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            تفتقد صلاحية projects.review — الإشراف على طلبات العروض للمراجع أو مدير العمليات.
          </p>
        ) : (
          <RfqsTable rows={rfqs} />
        )}

        {rfqCursor ? (
          <div className="text-center">
            <Link
              href={`/ops/suppliers${qs({ status: sp.status, cursor: rfqCursor })}`}
              className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
            >
              الأقدم ↓
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
