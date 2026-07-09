'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { track } from '@/lib/analytics';

/** STAKES/O1 — one page_view per route change (App Router pathname). */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) track('page_view', {}, pathname);
  }, [pathname]);
  return null;
}
