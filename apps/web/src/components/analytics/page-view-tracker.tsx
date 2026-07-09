'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { track } from '@/lib/analytics';

/** STAKES/O1 — one page_view per route change (App Router pathname).
 *  S-14 (I4) — also captures ?ref= into localStorage so pledge events can
 *  attribute the referral (analytics-level only, never payout-level). */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref && /^[\w-]{1,64}$/.test(ref)) localStorage.setItem('wathba_ref', ref);
    } catch {
      /* storage unavailable */
    }
    if (pathname) track('page_view', {}, pathname);
  }, [pathname]);
  return null;
}
