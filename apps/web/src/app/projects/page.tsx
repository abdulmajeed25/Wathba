import type { Metadata } from 'next';

import { adaptDiscoverProject } from '@/components/ventures/wathba/wathba-data';
import { WathbaHeroRotator } from '@/components/ventures/wathba/wathba-hero-rotator';
import { WathbaHeroSlideBody } from '@/components/ventures/wathba/wathba-hero-slide-body';
import { WathbaHome } from '@/components/ventures/wathba/wathba-home';
import { wathbaMagazineRenderers } from '@/components/ventures/wathba/wathba-home-magazine';
import { WathbaProjectsRail } from '@/components/ventures/wathba/wathba-similar-rail';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getHeroProjects, getHomePayload, getPopularFacets, getRecommendedProjects, listCategories, listDiscover } from '@/lib/api/wathba';

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
  const [live, cats, recommended, home, heroSlides, popularFacets] = await Promise.all([
    // HOME-REVIEW D1 — the trending grid draws REAL projects now. It used to go
    // through listVentures() → adaptApiVenture(), which matched a UUID against
    // the demo fixtures' titleEn, never matched, and silently fell back to the
    // bundled eight. /v1/discover returns the same card shape the rest of the
    // discovery surface already uses.
    listDiscover({ take: 12 }),
    // The project row carries categoryId only; the names live here.
    listCategories(),
    // STAKES/J4 — signed-in backers get "لأنك دعمت…" (null when anonymous).
    getRecommendedProjects().catch(() => null),
    // Batch HOME — the admin-composed magazine sections below the fold.
    getHomePayload().catch(() => null),
    // Batch HERO — the rotating featured card's pool. Server-fetched so the
    // first slide's cover is in the initial HTML and stays the LCP element.
    getHeroProjects().catch(() => []),
    // Batch DISCOVERY-ENGINE Unit 5 — the learned chip row. In the SAME
    // Promise.all as everything else: it must never add a serial hop to a page
    // whose LCP budget is 704ms, and [] on failure means the row just vanishes.
    getPopularFacets().catch(() => []),
  ]);
  const catNameById = new Map<string, string>();
  for (const top of cats ?? []) {
    catNameById.set(top.id, top.nameAr);
    for (const child of top.children ?? []) catNameById.set(child.id, child.nameAr);
  }
  // Undefined (not []) when the API is unreachable, so WathbaHome falls back to
  // the bundled fixtures and the page still renders — the fallback stays a real
  // fallback instead of the silent default it had become.
  const projects = live?.items?.length
    ? live.items.map((p) => adaptDiscoverProject(p, catNameById))
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
      {/* HOME-REVIEW — ONE ordered list. `order` is HomepageSection.sortOrder
          as the API returns it, and the magazine's renderers are merged into
          the same map, so the two halves interleave instead of the magazine
          being welded below everything. Reordering the homepage is now a data
          change through content.homepage-section.update, not a deploy. */}
      <WathbaHome
        projects={projects && projects.length > 0 ? projects : undefined}
        // HOME-REVIEW O4 — the chip row draws the LIVE taxonomy. It used to
        // draw the bundled `wathbaCategories` fixture, whose `film` and `tech`
        // are `film-video` and `technology` here, so two of the eight chips
        // pointed at categories that do not exist.
        categories={cats ?? undefined}
        popularFacets={popularFacets}
        order={home?.sections.map((s) => s.key)}
        extraRenderers={
          home ? wathbaMagazineRenderers(home, home.sections.map((s) => s.key)) : undefined
        }
        hero={
          heroSlides.length > 0 ? (
            // Composed HERE, in a server component, so the card bodies never
            // become client code. WathbaHome is 'use client', so anything it
            // renders itself would be — the hero has to be built above it and
            // passed down as an element.
            <WathbaHeroRotator slides={heroSlides}>
              {heroSlides.map((s) => (
                <WathbaHeroSlideBody key={s.id} slide={s} />
              ))}
            </WathbaHeroRotator>
          ) : null
        }
      />
    </WathbaShell>
  );
}
