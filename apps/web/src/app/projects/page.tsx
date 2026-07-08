import type { Metadata } from 'next';

import { adaptApiVenture } from '@/components/ventures/wathba/wathba-data';
import { WathbaHome } from '@/components/ventures/wathba/wathba-home';
import { WathbaProjectsRail } from '@/components/ventures/wathba/wathba-similar-rail';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getRecommendedProjects, listVentures } from '@/lib/api/wathba';

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
  const [live, recommended] = await Promise.all([
    listVentures(),
    // STAKES/J4 — signed-in backers get "لأنك دعمت…" (null when anonymous).
    getRecommendedProjects().catch(() => null),
  ]);
  const projects = live
    ? live.map(adaptApiVenture).filter((p): p is NonNullable<typeof p> => p !== null)
    : undefined;
  return (
    <WathbaShell>
      {recommended && recommended.items.length > 0 && (
        <WathbaProjectsRail
          title="لأنك دعمت…"
          subtitle={`مشاريع نشطة في فئات دعمتها: ${recommended.basedOn.join('، ')}`}
          projects={recommended.items}
        />
      )}
      <WathbaHome projects={projects && projects.length > 0 ? projects : undefined} />
    </WathbaShell>
  );
}
