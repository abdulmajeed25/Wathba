import type { Metadata } from 'next';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { WathbaSupplier } from '@/components/ventures/wathba/wathba-supplier';

export const metadata: Metadata = { title: 'بوابة الموردين · وثبة' };

export default function SupplierPage() {
  return (
    <WathbaShell>
      <WathbaSupplier />
    </WathbaShell>
  );
}
