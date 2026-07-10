import type { MetadataRoute } from 'next';

import { listCategories, listSitemapProjects } from '@/lib/api/wathba';
import { SITE_URL } from '@/lib/site';

/**
 * STAKES/N2 — live projects + category tree + the static/trust pages.
 * API outages degrade to the static set (never a 500 sitemap).
 * STAKES/S-10 F-10 — project URLs use the /p/[slug] canonical when slugged
 * (previously the sitemap advertised /projects/{uuid} while the pages
 * canonicalized to /p/{slug}, so the readable URLs never reached crawlers),
 * and the source pages through discover instead of the first-page-only list.
 */
export const revalidate = 3600;

const STATIC_PATHS = [
  '/projects',
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
  const [projects, categories] = await Promise.all([
    listSitemapProjects().catch(() => null),
    listCategories().catch(() => null),
  ]);

  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '/projects' ? 'daily' : 'weekly',
    priority: path === '/projects' ? 1 : 0.6,
  }));

  for (const p of projects ?? []) {
    entries.push({
      // Must match the page's own canonical: /p/[slug] when slugged, else id.
      url: p.slug ? `${SITE_URL}/p/${p.slug}` : `${SITE_URL}/projects/${p.id}`,
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
