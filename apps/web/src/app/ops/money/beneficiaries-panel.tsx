import Link from 'next/link';

import { API_BASE } from '../_lib/guard';
import { qs } from '../_lib/filters';
import { StatusBadge } from '../_components/badge';

interface BeneficiaryRow {
  userId: string;
  creatorName?: string | null;
  ibanMasked: string | null;
  mobileMasked: string | null;
  type: string;
  verified: boolean;
  hasMoyasarAccount: boolean;
  createdAt: string;
}

/**
 * OPS-360 Unit 3 — payout-beneficiary browser. A payout cannot disburse
 * without a beneficiary row, yet the census found it entirely unviewable in
 * ops. This surfaces the masked IBAN/mobile + verification + whether a
 * Moyasar payout account is registered (a PENDING-forever payout usually
 * means this is missing). Read-only — bank details are edited by the creator.
 */
export async function BeneficiariesPanel({ opsToken, cursor }: { opsToken: string; cursor?: string }) {
  let rows: BeneficiaryRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  try {
    const res = await fetch(`${API_BASE}/v1/ops/money/beneficiaries${qs({ cursor, limit: '50' })}`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (res.status === 403) refused = true;
    else if (res.ok) {
      const b = (await res.json()) as { items: BeneficiaryRow[]; nextCursor: string | null };
      rows = b.items;
      nextCursor = b.nextCursor;
    }
  } catch {
    /* tolerated */
  }

  if (refused) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        تفتقد صلاحية <code dir="ltr">money.execute</code> لعرض المستفيدين.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <p className="text-xs text-[#8b949e]">
        المستفيد البنكي شرطٌ لصرف أي دفعة. دفعة عالقة على «معلّقة» بلا سبب غالباً تعني غياب حساب مزوّد الصرف أدناه. البيانات للعرض فقط — يحرّرها المبدع.
      </p>
      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">المبدع</th>
              <th className="px-3 py-2 font-medium">الآيبان</th>
              <th className="px-3 py-2 font-medium">الجوال</th>
              <th className="px-3 py-2 font-medium">النوع</th>
              <th className="px-3 py-2 font-medium">موثّق</th>
              <th className="px-3 py-2 font-medium">حساب الصرف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#8b949e]">
                  لا مستفيدين.
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.userId}>
                <td className="px-3 py-2">
                  <Link href={`/ops/users/${b.userId}`} className="text-[#58a6ff] hover:underline">
                    {b.creatorName ?? `${b.userId.slice(0, 8)}…`}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-[#8b949e]" dir="ltr">{b.ibanMasked ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-[#8b949e]" dir="ltr">{b.mobileMasked ?? '—'}</td>
                <td className="px-3 py-2">{b.type}</td>
                <td className="px-3 py-2">
                  <StatusBadge intent={b.verified ? 'ok' : 'warn'}>{b.verified ? 'موثّق' : 'غير موثّق'}</StatusBadge>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge intent={b.hasMoyasarAccount ? 'ok' : 'danger'}>
                    {b.hasMoyasarAccount ? 'مُسجَّل' : 'غير مُسجَّل'}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <a href={`/ops/money${qs({ tab: 'beneficiaries', cursor: nextCursor })}`} className="inline-block text-sm text-[#58a6ff] hover:underline">
          الأقدم ↓
        </a>
      )}
    </section>
  );
}
