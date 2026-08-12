import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { WathbaFollowing } from '@/components/ventures/wathba/wathba-following';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'متابَعاتي · وثبة' };
export const dynamic = 'force-dynamic';

export default async function FollowingPage() {
  if (!(await getMe())) redirect('/sign-in?next=%2Ffollowing');
  return (
    <WathbaShell>
      <WathbaFollowing />
    </WathbaShell>
  );
}
