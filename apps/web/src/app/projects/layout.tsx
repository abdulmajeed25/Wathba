import type { ReactNode } from 'react';

import { WathbaProviders } from '@/components/ventures/wathba/wathba-providers';

/**
 * Ventures (وثبة) pillar layout — bypasses the platform AppShell because
 * Wathba ships its own sticky header + footer (per the designer's
 * WATBHوثبة.dc.html). The platform shell's top-bar nav links here via the
 * المشاريع والتمويل entry; once inside, the user is in Wathba's world.
 *
 * Wraps every /projects/* route in WathbaProviders so client components
 * have access to TanStack Query (useQuery / useMutation).
 */
export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <WathbaProviders>{children}</WathbaProviders>;
}
