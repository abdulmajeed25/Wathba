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
