import type { MetadataRoute } from 'next';

import { listCategories, listRules, listSitemapProjects } from '@/lib/api/wathba';
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
  '/projects/legal/terms',
  '/projects/legal/privacy',
  '/projects/legal/refund-policy',
  // Batch CONTENT 1C — the legal quartet was a trio here; contracts was
  // footer-linked and reachable but invisible to crawlers.
  '/projects/legal/contracts',
  '/spotlight',
  // The rules hub. Its five sub-pages are appended below from the API rather
  // than hardcoded, so adding a rule in the ops console puts it in the sitemap
  // without a deploy — the same reason the pages are EditorialCards at all.
  '/rules',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, categories, rules] = await Promise.all([
    listSitemapProjects().catch(() => null),
    listCategories().catch(() => null),
    listRules().catch(() => []),
  ]);

  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '/projects' ? 'daily' : 'weekly',
    priority: path === '/projects' ? 1 : 0.6,
  }));

  // Rules sub-pages, sourced from the API so a rule added in the ops console is
  // crawlable without a deploy.
  for (const r of rules) {
    entries.push({
      url: `${SITE_URL}/rules/${r.slug.replace(/^rules-/, '')}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

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
