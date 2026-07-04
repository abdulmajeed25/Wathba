'use client';

import { useEffect, useState } from 'react';

/**
 * STAKES/S-2 — matchMedia hook for responsive layout. The app is styled with
 * inline styles (no CSS media queries), so components switch layout via this.
 * Returns false during SSR / first paint (desktop-first), then corrects.
 */
export function useIsMobile(maxWidth = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [maxWidth]);
  return isMobile;
}
