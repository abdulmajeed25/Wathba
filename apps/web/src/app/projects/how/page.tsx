import type { Metadata } from 'next';

import { WathbaHow } from '@/components/ventures/wathba/wathba-how';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'كيف تعمل · وثبة' };

export default function HowPage() {
  return (
    <WathbaShell>
      <WathbaHow />
    </WathbaShell>
  );
}
