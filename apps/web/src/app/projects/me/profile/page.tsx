import type { Metadata } from 'next';

import { WathbaProfile } from '@/components/ventures/wathba/wathba-profile';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe, listMyBackings, listMySaved } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'الملف الشخصي · وثبة' };

// Per-user, middleware-gated page — must never be statically prerendered.
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [backings, saved, me] = await Promise.all([listMyBackings(), listMySaved(), getMe()]);
  return (
    <WathbaShell>
      <WathbaProfile backings={backings} saved={saved} me={me} />
    </WathbaShell>
  );
}
