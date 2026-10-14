import type { Prisma } from '@prisma/client';

export interface ContentProject {
  createdById: string;
  status: string;
  hiddenAt: Date | null;
  applicationApprovedAt: Date | null;
}

/** Legacy launched campaigns predate the explicit initial-approval timestamp. */
export function contentWorkspaceOpen(project: Pick<ContentProject, 'status' | 'applicationApprovedAt'>): boolean {
  return Boolean(project.applicationApprovedAt) || !['DRAFT', 'UNDER_REVIEW'].includes(project.status);
}

/** Only the existing EDITOR role grants update access; unknown future roles do not. */
export async function isUpdateEditor(
  db: Pick<Prisma.TransactionClient, 'projectCollaborator'>,
  projectId: string,
  project: ContentProject,
  userId?: string,
): Promise<boolean> {
  if (!userId || project.hiddenAt || !contentWorkspaceOpen(project)) return false;
  const membership = await db.projectCollaborator.findUnique({
    where: { projectId_userId: { projectId, userId } }, select: { role: true },
  });
  return membership?.role === 'EDITOR';
}
