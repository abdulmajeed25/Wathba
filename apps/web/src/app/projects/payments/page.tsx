import type { Metadata } from 'next';

import { WathbaPayments } from '@/components/ventures/wathba/wathba-payments';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listMyBackings, listMyPayouts } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'المدفوعات · وثبة' };

export default async function PaymentsPage() {
  // Both calls are server-side; auth cookie is read from the request store.
  // Either returns null when the endpoint is unreachable / no data.
  const [pledges, payouts] = await Promise.all([listMyBackings(), listMyPayouts()]);
  return (
    <WathbaShell>
      <WathbaPayments pledges={pledges} payouts={payouts} />
    </WathbaShell>
  );
}
