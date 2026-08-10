import type { Metadata } from 'next';

import { WathbaDashboard } from '@/components/ventures/wathba/wathba-dashboard';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listMyApplications, listMyBackings, listMyProjects } from '@/lib/api/wathba';
import { requireCreator } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'لوحة التحكم · وثبة' };

// Per-user, middleware-gated page — must never be statically prerendered.
export const dynamic = 'force-dynamic';

/**
 * Creator Dashboard — server-rendered. We fan out the two protected
 * /me reads in parallel; both return `null` for unauthenticated SSR (no
 * bearer token threaded through yet) and the component falls back to the
 * design fixture so the surface always renders.
 */
export default async function DashboardPage() {
  // STAKES/B2 — reject users who aren't creators (0 projects → /projects/start).
  await requireCreator();
  // The KPI tiles are computed from the creator's OWN campaigns; without this
  // read they were literals that contradicted the creator's real numbers.
  const [backings, applications, myProjects] = await Promise.all([
    listMyBackings(),
    listMyApplications(),
    listMyProjects(),
  ]);
  return (
    <WathbaShell>
      <WathbaDashboard backings={backings} applications={applications} myProjects={myProjects} />
    </WathbaShell>
  );
}
