import type { Metadata } from 'next';

import { adaptApiVenture } from '@/components/ventures/wathba/wathba-data';
import { WathbaHome } from '@/components/ventures/wathba/wathba-home';
import { WathbaHomeMagazine } from '@/components/ventures/wathba/wathba-home-magazine';
import { WathbaProjectsRail } from '@/components/ventures/wathba/wathba-similar-rail';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getHeroProjects, getHomePayload, getRecommendedProjects, listVentures } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'وثبة — منصة دعم المشاريع' };

/**
 * Ventures pillar landing (`/projects`). Mounts the faithful وثبة (Wathba)
 * port of WATBHوثبة.dc.html. The earlier composite `VenturesHub` view is
 * archived; admin / portal surfaces hang off the deep routes
 * (`/projects/:id/...`) and stay reachable.
 */
// STAKES/J4 — the rail is per-viewer (session cookie) so the page can't be
// statically prerendered anymore.
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const [live, recommended, home, heroSlides] = await Promise.all([
    listVentures(),
    // STAKES/J4 — signed-in backers get "لأنك دعمت…" (null when anonymous).
    getRecommendedProjects().catch(() => null),
    // Batch HOME — the admin-composed magazine sections below the fold.
    getHomePayload().catch(() => null),
    // Batch HERO — the rotating featured card's pool. Server-fetched so the
    // first slide's cover is in the initial HTML and stays the LCP element.
    getHeroProjects().catch(() => []),
  ]);
  const projects = live
    ? live.map(adaptApiVenture).filter((p): p is NonNullable<typeof p> => p !== null)
    : undefined;
  // The hero cover is the LCP element, and it lives on the media origin — a
  // different host to this one. Two things were costing it ~390ms against the
  // pre-hero baseline: the browser paid a fresh connection to :9000, and Next
  // emits NO preload for a `priority` image while `images.unoptimized` is on, so
  // the fetch only began when the parser reached the <img>. Measured, not
  // assumed: `priority` produced zero `rel=preload` links in the served HTML.
  const heroCover = heroSlides[0]?.imageUrl ?? null;
  const mediaOrigin = heroCover ? new URL(heroCover).origin : null;

  return (
    <WathbaShell>
      {/* No crossOrigin: next/image fetches the cover WITHOUT CORS, and a
          crossorigin preconnect warms a different connection pool than a
          non-CORS request uses — the warm socket would go unused. */}
      {mediaOrigin && <link rel="preconnect" href={mediaOrigin} />}
      {heroCover && (
        <link rel="preload" as="image" href={heroCover} fetchPriority="high" />
      )}
      {recommended && recommended.items.length > 0 && (
        <WathbaProjectsRail
          title="لأنك دعمت…"
          subtitle={`مشاريع نشطة في فئات دعمتها: ${recommended.basedOn.join('، ')}`}
          projects={recommended.items}
        />
      )}
      <WathbaHome
        projects={projects && projects.length > 0 ? projects : undefined}
        heroSlides={heroSlides}
      />
      {home && <WathbaHomeMagazine payload={home} />}
    </WathbaShell>
  );
}
