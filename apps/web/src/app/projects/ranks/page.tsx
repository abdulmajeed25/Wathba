import type { Metadata } from 'next';

import { WathbaRanks } from '@/components/ventures/wathba/wathba-ranks';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'رتب الداعمين · وثبة' };

export default function RanksPage() {
  return (
    <WathbaShell>
      <WathbaRanks />
    </WathbaShell>
  );
}
