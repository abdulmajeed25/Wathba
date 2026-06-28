import type { Metadata } from 'next';

import { WathbaContracts } from '@/components/ventures/wathba/wathba-contracts';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'عقود الدعم · وثبة' };

export default function ContractsPage() {
  return (
    <WathbaShell>
      <WathbaContracts />
    </WathbaShell>
  );
}
