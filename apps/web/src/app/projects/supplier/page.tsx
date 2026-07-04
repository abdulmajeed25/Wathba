import type { Metadata } from 'next';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaSupplier } from '@/components/ventures/wathba/wathba-supplier';
import { listMyBids, listRfqs } from '@/lib/api/wathba';
import { requireRole } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'بوابة الموردين · وثبة' };

// Per-user, middleware-gated page — must never be statically prerendered.
export const dynamic = 'force-dynamic';

export default async function SupplierPage() {
  // STAKES/B6 — SUPPLIER only, enforced server-side.
  await requireRole('SUPPLIER');
  // Pre-fetch RFQs + the supplier's bids on the server. Returns null when the
  // endpoint is unreachable or returns an error; the client component then
  // falls back to the bundled fixture (wathbaRfqs / wathbaMySupplierBids).
  const [rfqs, myBids] = await Promise.all([listRfqs(), listMyBids()]);
  return (
    <WathbaShell>
      <WathbaSupplier liveRfqs={rfqs} liveMyBids={myBids} />
    </WathbaShell>
  );
}
