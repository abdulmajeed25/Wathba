'use client';

import { useEffect, useRef } from 'react';

/**
 * STAKES/S-14 (P3) — Cloudflare Turnstile slot, env-flagged.
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY unset (dev/e2e default) → renders nothing
 * and the API skips verification. Set both keys in production to arm the
 * gate. Implicit rendering injects the `cf-turnstile-response` hidden input
 * into the surrounding <form>; server actions forward it as captchaToken.
 */
export function TurnstileSlot() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    if (document.querySelector('script[data-turnstile]')) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.setAttribute('data-turnstile', '1');
    document.head.appendChild(s);
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="cf-turnstile" data-sitekey={siteKey} data-language="ar" />;
}
