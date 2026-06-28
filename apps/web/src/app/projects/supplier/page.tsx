import type { Metadata } from 'next';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaSupplier } from '@/components/ventures/wathba/wathba-supplier';
import { listMyBids, listRfqs } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'بوابة الموردين · وثبة' };

export default async function SupplierPage() {
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
