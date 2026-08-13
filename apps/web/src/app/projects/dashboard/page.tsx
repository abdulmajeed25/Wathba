import type { Metadata } from 'next';

import { WathbaDashboard } from '@/components/ventures/wathba/wathba-dashboard';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listMyBackings, listMyProjects } from '@/lib/api/wathba';
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
  // Batch ACCOUNT / U6 — listMyApplications() was a stub that returned null
  // ("No /applications endpoint on Wathba apps/api yet") and there is no
  // request/application model in the schema at all, so the dashboard was
  // rendering an "applications" concept from nothing. Owner decision: read
  // Project directly — UNDER_REVIEW is submitted, DRAFT + reviewFeedback is
  // rejected — and delete the stub rather than keep a null-shaped placeholder
  // that reads like a feature.
  const [backings, myProjects] = await Promise.all([
    listMyBackings(),
    listMyProjects(),
  ]);
  return (
    <WathbaShell>
      <WathbaDashboard backings={backings} applications={null} myProjects={myProjects} />
    </WathbaShell>
  );
}
