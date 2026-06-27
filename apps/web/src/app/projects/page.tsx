import type { Metadata } from 'next';

import { adaptApiVenture } from '@/components/ventures/wathba/wathba-data';
import { WathbaHome } from '@/components/ventures/wathba/wathba-home';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listVentures } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'وثبة — منصة دعم المشاريع' };

/**
 * Ventures pillar landing (`/projects`). Mounts the faithful وثبة (Wathba)
 * port of WATBHوثبة.dc.html. The earlier composite `VenturesHub` view is
 * archived; admin / portal surfaces hang off the deep routes
 * (`/projects/:id/...`) and stay reachable.
 */
export default async function ProjectsPage() {
  const live = await listVentures();
  const projects = live
    ? live.map(adaptApiVenture).filter((p): p is NonNullable<typeof p> => p !== null)
    : undefined;
  return (
    <WathbaShell>
      <WathbaHome projects={projects && projects.length > 0 ? projects : undefined} />
    </WathbaShell>
  );
}
