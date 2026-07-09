'use client';

/**
 * STAKES/O1 O3 — the client event layer. Privacy by construction:
 *  - anonId is a RANDOM uuid in localStorage (nothing derived, no cookies)
 *  - no IP/user-agent is sent or stored (the API has no columns for them)
 *  - names are whitelisted server-side; unknown events are dropped
 * Uses sendBeacon so page navigation never waits on analytics.
 */

const KEY = 'wathba_anon_id';

function anonId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked — track anonymously without an id
  }
}

export function track(
  name: string,
  props: Record<string, unknown> = {},
  path?: string,
): void {
  try {
    const payload = JSON.stringify({
      name,
      anonId: anonId(),
      path: path ?? (typeof location !== 'undefined' ? location.pathname : undefined),
      // STAKES/S-14 (I4) — referral attribution rides every event when set.
      props: (() => {
        try {
          const ref = localStorage.getItem('wathba_ref');
          return ref ? { ref, ...props } : props;
        } catch {
          return props;
        }
      })(),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([payload], { type: 'application/json' }));
    } else {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    /* analytics must never break the page */
  }
}
