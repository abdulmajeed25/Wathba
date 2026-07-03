import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WathbaProjectPreview } from '@/components/ventures/wathba/dashboard/wathba-project-preview';
import { getProjectDetail } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'معاينة الحملة · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Draft preview-as-visitor (Creator-CC / CC-19). Renders the project's real
 * content as a visitor sees it — works for DRAFT/UNDER_REVIEW projects that
 * aren't on the public campaign page yet. Owner-gating is enforced by the
 * dashboard layout (non-owners are bounced before reaching here).
 */
export default async function DashboardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const project = await getProjectDetail(id);
  if (!project) notFound();
  return <WathbaProjectPreview projectId={id} project={project} />;
}
