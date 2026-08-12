import { notFound, redirect } from 'next/navigation';

import { DashboardShell } from '@/components/ventures/wathba/dashboard/wathba-dashboard-shell';
import { getMe, getProjectDetail } from '@/lib/api/wathba';

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
  const [me, project] = await Promise.all([getMe(), getProjectDetail(id)]);
  if (!project) notFound();
  if (!me || me.id !== project.createdBy) redirect('/projects/dashboard');

  /**
   * Batch ACCOUNT §4.1 — the STATUS half of the gate.
   *
   * Ownership was already enforced above; project state was not, so the owner
   * of an untouched DRAFT reached the full dashboard — seventeen sections of
   * backers, payouts, milestones and analytics for a campaign that has never
   * been reviewed, every one of them empty. An empty dashboard is not a
   * neutral outcome: it reads as "your project is live and nobody came".
   *
   * A dashboard is for managing a campaign that EXISTS. Before review there is
   * nothing to manage, so a draft goes back to the editor and a submission
   * goes to its review status. These are the same destinations the account
   * menu's project rows use — the menu and the direct URL must not disagree
   * about where a draft belongs.
   *
   * forbidden() and not notFound(): the project is real and the reader owns
   * it. Telling them it does not exist would be a lie they can disprove.
   */
  if (project.status === 'DRAFT') {
    redirect(`/projects/submit?draft=${encodeURIComponent(project.id)}`);
  }
  if (project.status === 'UNDER_REVIEW') {
    // Deliberately OUTSIDE the [id] tree. A status tracker nested under this
    // layout would be wrapped by this same layout and redirect to itself
    // forever — the gate would present as a hang, not as a refusal.
    redirect(`/projects/dashboard/requests/${encodeURIComponent(project.id)}`);
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
