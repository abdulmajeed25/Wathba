import type { Metadata } from 'next';

import { WathbaMyPledges } from '@/components/ventures/wathba/wathba-my-pledges';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listMyBackings } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'مكفوفاتي · وثبة' };

export default async function MyPledgesPage() {
  const pledges = await listMyBackings();
  return (
    <WathbaShell>
      <WathbaMyPledges pledges={pledges} />
    </WathbaShell>
  );
}
