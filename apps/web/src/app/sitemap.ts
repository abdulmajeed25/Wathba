import type { MetadataRoute } from 'next';

import { listCategories, listVentures } from '@/lib/api/wathba';
import { SITE_URL } from '@/lib/site';

/**
 * STAKES/N2 — live projects + category tree + the static/trust pages.
 * API outages degrade to the static set (never a 500 sitemap).
 */
export const revalidate = 3600;

const STATIC_PATHS = [
  '/projects',
  '/projects/discover',
  '/projects/discover-all',
  '/projects/campaigns',
  '/projects/how',
  '/projects/about',
  '/projects/pricing',
  '/projects/handbook',
  '/projects/help',
  '/projects/ranks',
  '/projects/v2030',
  '/projects/legal/terms',
  '/projects/legal/privacy',
  '/projects/legal/refund-policy',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [ventures, categories] = await Promise.all([
    listVentures().catch(() => null),
    listCategories().catch(() => null),
  ]);

  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '/projects' ? 'daily' : 'weekly',
    priority: path === '/projects' ? 1 : 0.6,
  }));

  for (const v of ventures ?? []) {
    if (v.state !== 'live' && v.state !== 'funded') continue;
    entries.push({
      url: `${SITE_URL}/projects/${v.id}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }

  for (const top of categories ?? []) {
    entries.push({
      url: `${SITE_URL}/projects/discover/${top.slug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    });
    for (const child of top.children ?? []) {
      entries.push({
        url: `${SITE_URL}/projects/discover/${top.slug}/${child.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
  }

  return entries;
}
