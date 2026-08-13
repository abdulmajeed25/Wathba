import { notFound, redirect } from 'next/navigation';

import { DashboardShell } from '@/components/ventures/wathba/dashboard/wathba-dashboard-shell';
import { getMe, getProjectDetailLive } from '@/lib/api/wathba';

/**
 * Per-project creator dashboard layout. Server-renders the section nav and
 * project header. Ownership check: hits /v1/users/me and /v1/projects/:id,
 * bounces non-owners back to the project picker.
 *
 * Middleware already requires a session cookie for /projects/dashboard/* (see
 * apps/web/src/middleware.ts), so by the time we get here we have at least
 * a logged-in user; this layout enforces the *owner* check on top.
 */
export default async function DashboardProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const [me, project] = await Promise.all([getMe(), getProjectDetailLive(id)]);
  if (!project) notFound();
  if (!me || me.id !== project.createdBy) redirect('/projects/dashboard');

  /**
   * Batch ACCOUNT / U6 — the STATUS half of the gate.
   *
   * Ownership was enforced above; project state was not, so the owner of an
   * untouched DRAFT reached the full dashboard — seventeen sections of backers,
   * payouts, milestones and analytics for a campaign that has never been
   * reviewed, every one of them empty. An empty dashboard is not a neutral
   * outcome: it reads as "your project is live and nobody came".
   *
   * A dashboard is for managing a campaign that EXISTS. Before review there is
   * nothing to manage, so a draft goes back to the editor and a submission to
   * its status tracker. These are the same destinations the account menu's
   * project rows use (wathba-account-nav.projectRowHref) — the menu and a
   * pasted URL must not disagree about where a draft belongs.
   *
   * REJECTION IS NOT A STATUS here: a rejected project sits in DRAFT carrying
   * reviewFeedback, so it is detected as that PAIR and sent to the tracker
   * rather than to the editor, which would drop the reason on the floor.
   */
  const rejected = project.status === 'DRAFT' && Boolean(project.reviewFeedback);
  if (rejected || project.status === 'UNDER_REVIEW') {
    // OUTSIDE the [id] tree deliberately — a tracker nested under the layout
    // that redirects to it would redirect to itself forever, and the gate would
    // present as a hang rather than a refusal.
    redirect(`/projects/dashboard/requests/${encodeURIComponent(project.id)}`);
  }
  if (project.status === 'DRAFT') {
    redirect(`/projects/submit?draft=${encodeURIComponent(project.id)}`);
  }

  return (
    <DashboardShell
      projectId={project.id}
      projectTitle={project.titleAr}
      projectStatus={project.status}
    >
      {children}
    </DashboardShell>
  );
}
