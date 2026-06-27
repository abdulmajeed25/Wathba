import type { Metadata } from 'next';

import { WathbaProfile } from '@/components/ventures/wathba/wathba-profile';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listMyBackings } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'الملف الشخصي · وثبة' };

export default async function ProfilePage() {
  const backings = await listMyBackings();
  return (
    <WathbaShell>
      <WathbaProfile backings={backings} />
    </WathbaShell>
  );
}
