import type { Metadata } from 'next';

import { WathbaAdmin } from '@/components/ventures/wathba/wathba-admin';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'الإدارة · وثبة' };

export default function AdminPage() {
  return (
    <WathbaShell>
      <WathbaAdmin />
    </WathbaShell>
  );
}
