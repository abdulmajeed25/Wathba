'use client';

import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Wathba client providers — currently TanStack Query only. Mounted from
 * apps/web/src/app/projects/layout.tsx so every screen under /projects/*
 * can use useQuery / useMutation for any data already SSR'd or fetched on
 * the client.
 *
 * The QueryClient is instantiated lazily (useState init) so a fresh client
 * lives once per browser tab (not per render); SSR is opt-in per hook via
 * `initialData` when the page already pre-fetched on the server.
 */
export function WathbaProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
