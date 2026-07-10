import type { Metadata } from 'next';

import { adaptApiVenture, wathbaProjects, type WathbaProject } from '@/components/ventures/wathba/wathba-data';
import { getProjectDetail, listVentures } from '@/lib/api/wathba';

/**
 * TABS — the shared live-project resolution every tab route needs (same-URL
 * fetches dedupe within a request; the ISR data cache shares across them).
 */
export async function resolveLiveProject(id: string): Promise<WathbaProject | undefined> {
  const live = await listVentures();
  const apiRow = live?.find((v) => v.slug.toLowerCase() === id.toLowerCase());
  return apiRow ? (adaptApiVenture(apiRow) ?? undefined) : undefined;
}

/**
 * TABS — per-tab-route metadata: «{tab} · {project} · وثبة», own canonical
 * under /projects/[id]/<tab>, OG image inherits the project cover (the story
 * page keeps the primary funded-% share card).
 */
export async function campaignTabMetadata(
  id: string,
  tabLabel: string,
  tabPath: string,
  description: string,
): Promise<Metadata> {
  const live = await getProjectDetail(id).catch(() => null);
  const fixture = wathbaProjects.find((p) => p.id === id);
  const projectTitle = live?.titleAr ?? fixture?.titleAr ?? `مشروع ${id}`;
  const title = `${tabLabel} · ${projectTitle} · وثبة`;
  const canonical = `/projects/${id}/${tabPath}`;
  const ogImage = live?.ogImage ?? live?.mediaUrls?.[0] ?? '/og-default.png';
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'article', url: canonical, images: [{ url: ogImage }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}
