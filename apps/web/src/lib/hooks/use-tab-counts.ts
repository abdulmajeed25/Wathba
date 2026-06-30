'use client';

import { useEffect, useState } from 'react';

import type { ApiTabCounts } from '@/lib/api/wathba';

/**
 * Live campaign-page tab counts. Polls every 30 s (the same cadence as
 * the funding rail before N4 made it socket-driven). Returns `null` on
 * first load + on API error — caller falls back to its static badges.
 */
export function useTabCounts(projectId: string): ApiTabCounts | null {
  const [counts, setCounts] = useState<ApiTabCounts | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = async (): Promise<void> => {
      try {
        const r = await fetch(`/api/tab-counts?projectId=${encodeURIComponent(projectId)}`);
        if (!r.ok) return;
        const data = (await r.json()) as ApiTabCounts;
        if (!cancel) setCounts(data);
      } catch {
        /* swallow — keep static badges */
      }
    };
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [projectId]);

  return counts;
}
