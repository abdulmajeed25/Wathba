import type { Metadata } from 'next';

import {
  adaptApiVenture,
  wathbaProjects,
} from '@/components/ventures/wathba/wathba-data';
import { WathbaCampaign } from '@/components/ventures/wathba/wathba-campaign';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listVentures } from '@/lib/api/wathba';

/**
 * Project / campaign page — full Kickstarter-style surface (rich header +
 * hero video + funding rail + trust band + 8 tabs incl. the 3-col campaign
 * tab with TOC). Public per M1 (middleware no longer gates this path);
 * action buttons inside the page bounce through /sign-in?next=<orig>.
 *
 * Server-rendered for SEO + first-paint speed. The live API lookup falls
 * back to the bundled fixture so anonymous browsing of the demo projects
 * (p1–p8) works even when the DB is empty.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const fixture = wathbaProjects.find((p) => p.id === id);
  const title = fixture ? `${fixture.titleAr} · وثبة` : `مشروع ${id} · وثبة`;
  return {
    title,
    description: fixture?.desc,
    openGraph: { title, description: fixture?.desc, type: 'article' },
  };
}

// ISR — re-render every 60s so the funding totals stay fresh without
// blowing the cache on every request. Per-project page.
export const revalidate = 60;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const live = await listVentures();
  const apiRow = live?.find((v) => v.slug.toLowerCase() === id.toLowerCase());
  const liveProject = apiRow ? adaptApiVenture(apiRow) : null;
  const fallback = wathbaProjects.find((p) => p.id === id);

  return (
    <WathbaShell>
      <WathbaCampaign id={id} project={liveProject ?? fallback ?? undefined} />
    </WathbaShell>
  );
}
