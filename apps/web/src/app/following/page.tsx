import type { Metadata } from 'next';

import { WathbaFollowing } from '@/components/ventures/wathba/wathba-following';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';

export const metadata: Metadata = { title: 'متابَعاتي · وثبة' };
export const dynamic = 'force-dynamic';

export default function FollowingPage() {
  return (
    <WathbaShell>
      <WathbaFollowing />
    </WathbaShell>
  );
}
