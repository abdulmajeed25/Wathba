import type { Metadata } from 'next';

import {
  adaptApiThread,
  adaptApiVenture,
  wathbaProjects,
} from '@/components/ventures/wathba/wathba-data';
import { WathbaProject } from '@/components/ventures/wathba/wathba-project';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import {
  getProjectTransparency,
  getTrustScore,
  listForumThreads,
  listProjectMilestones,
  listVentures,
} from '@/lib/api/wathba';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `مشروع ${id} · وثبة` };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const live = await listVentures();
  const apiRow = live?.find((v) => v.slug.toLowerCase() === id.toLowerCase());

  const project = apiRow ? adaptApiVenture(apiRow) : null;

  // Live v2 surfaces: pre-fetch transparency + milestones on the server when
  // we have an API row. Falls back to the fixtures (in wathba-project.tsx)
  // when the DB is empty or the slug isn't in the live list.
  const [trust, threads, transparency, milestones] = apiRow
    ? await Promise.all([
        getTrustScore(apiRow.id),
        listForumThreads(apiRow.id),
        getProjectTransparency(apiRow.id),
        listProjectMilestones(apiRow.id),
      ])
    : [null, null, null, null];

  const comments = threads?.map(adaptApiThread);
  const fallback = wathbaProjects.find((p) => p.id === id);

  return (
    <WathbaShell>
      <WathbaProject
        id={id}
        project={project ?? fallback ?? undefined}
        trustScore={trust?.score ?? null}
        comments={comments}
        transparency={transparency}
        milestones={milestones}
      />
    </WathbaShell>
  );
}
