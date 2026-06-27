import type { Metadata } from 'next';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaStart } from '@/components/ventures/wathba/wathba-start';

export const metadata: Metadata = { title: 'أطلق مشروعك · وثبة' };

export default function StartPage() {
  return (
    <WathbaShell>
      <WathbaStart />
    </WathbaShell>
  );
}
