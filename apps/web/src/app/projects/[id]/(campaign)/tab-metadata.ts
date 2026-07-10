import type { Metadata } from 'next';

import { wathbaProjects } from '@/components/ventures/wathba/wathba-data';
import { getProjectDetail } from '@/lib/api/wathba';

/**
 * TABS — per-tab metadata: «{tab} · {project} · وثبة», its own canonical
 * sub-route URL, OG image inherited from the project cover (the story page
 * keeps the primary share card with the funded-% description).
 */
export async function tabMetadata(
  id: string,
  tabLabel: string,
  route: string,
  descriptionAr: string,
): Promise<Metadata> {
  const live = await getProjectDetail(id).catch(() => null);
  const fixture = wathbaProjects.find((p) => p.id === id);
  const name = live?.titleAr ?? fixture?.titleAr ?? `مشروع ${id}`;
  const title = `${tabLabel} · ${name} · وثبة`;
  const description = `${descriptionAr} — ${name}`;
  const ogImage = live?.ogImage ?? live?.mediaUrls?.[0] ?? '/og-default.png';
  const canonical = `/projects/${live?.id ?? id}/${route}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, images: [{ url: ogImage }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}
