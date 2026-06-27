import type { Metadata } from 'next';

import { WathbaDashboard } from '@/components/ventures/wathba/wathba-dashboard';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listMyApplications, listMyBackings } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'لوحة التحكم · وثبة' };

/**
 * Creator Dashboard — server-rendered. We fan out the two protected
 * /me reads in parallel; both return `null` for unauthenticated SSR (no
 * bearer token threaded through yet) and the component falls back to the
 * design fixture so the surface always renders.
 */
export default async function DashboardPage() {
  const [backings, applications] = await Promise.all([listMyBackings(), listMyApplications()]);
  return (
    <WathbaShell>
      <WathbaDashboard backings={backings} applications={applications} />
    </WathbaShell>
  );
}
