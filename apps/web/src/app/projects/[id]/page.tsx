import type { Metadata } from 'next';

import {
  adaptApiThread,
  adaptApiVenture,
  wathbaProjects,
} from '@/components/ventures/wathba/wathba-data';
import { WathbaProject } from '@/components/ventures/wathba/wathba-project';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getTrustScore, listForumThreads, listVentures } from '@/lib/api/wathba';

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

  const [trust, threads] = apiRow
    ? await Promise.all([getTrustScore(apiRow.id), listForumThreads(apiRow.id)])
    : [null, null];

  const comments = threads?.map(adaptApiThread);

  const fallback = wathbaProjects.find((p) => p.id === id);

  return (
    <WathbaShell>
      <WathbaProject
        id={id}
        project={project ?? fallback ?? undefined}
        trustScore={trust?.score ?? null}
        comments={comments}
      />
    </WathbaShell>
  );
}
