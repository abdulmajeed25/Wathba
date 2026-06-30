import { notFound } from 'next/navigation';

import { DashboardStoryEditor } from '@/components/ventures/wathba/dashboard/wathba-dashboard-story-editor';
import { getProjectDetail } from '@/lib/api/wathba';

/**
 * Creator dashboard → Story.
 *
 * Server-fetches the project so we get the *latest* persisted storyAr (the
 * parent layout's fetch is fine for the header but we want a fresh read on
 * every visit so the editor never opens with stale text). Ownership is
 * already enforced by the dashboard layout — by the time we render, the
 * caller is guaranteed to be the project creator.
 */
export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const project = await getProjectDetail(id);
  if (!project) notFound();

  return (
    <DashboardStoryEditor projectId={project.id} initialStoryAr={project.storyAr ?? ''} />
  );
}
