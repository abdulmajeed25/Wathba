import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * The live funding socket must actually connect.
 *
 * `use-live-funding.ts` opens a socket.io connection to the API origin, which
 * the browser dials as `ws://`. CSP treats that as its own scheme and Chromium
 * does not accept an `http:` source as covering it, so `connect-src` listing
 * the API origin was not enough: every campaign page logged
 * `connect-src blocked ws://...:4000/socket.io/` and the funding rail was
 * frozen. Nothing in the UI said so — the numbers were simply the ones that
 * arrived with the HTML.
 *
 * The tempting assumption is that socket.io degrades to its `polling`
 * transport and keeps working. It does not: no polling request is ever made,
 * because the block surfaces as a connection error that socket.io retries on
 * the websocket transport. Verified against the running deployment before this
 * spec was written.
 *
 * So this asserts the socket reaches OPEN, not that markup exists and not that
 * the violation stopped — a page with the hook removed entirely would satisfy
 * "no violations" perfectly.
 */

test('L1: the funding socket opens, and no connect-src violation fires', async ({ page }) => {
  const res = await fetch(`${API}/v1/discover?take=1`);
  test.skip(!res.ok, 'API unreachable');
  const body = (await res.json()) as { items?: { slug: string }[] };
  const slug = body.items?.[0]?.slug;
  test.skip(!slug, 'no project to open a funding socket for');

  // Instrument BEFORE any app code runs — the socket is created during
  // hydration, so patching after load sees nothing and reads as a pass.
  await page.addInitScript(() => {
    const w = window as unknown as {
      __ws: { url: string; opened: boolean }[];
      __csp: string[];
      WebSocket: typeof WebSocket;
    };
    w.__ws = [];
    w.__csp = [];
    addEventListener('securitypolicyviolation', (e) =>
      w.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`),
    );
    const Native = w.WebSocket;
    const Patched = function (this: unknown, url: string | URL, protocols?: string | string[]) {
      const sock = new Native(url, protocols);
      const rec = { url: String(url), opened: false };
      w.__ws.push(rec);
      sock.addEventListener('open', () => {
        rec.opened = true;
      });
      return sock;
    } as unknown as typeof WebSocket;
    Patched.prototype = Native.prototype;
    w.WebSocket = Patched;
  });

  await page.goto(`/p/${slug}`);

  await expect
    .poll(
      async () =>
        page.evaluate(
          () => (window as unknown as { __ws: { url: string; opened: boolean }[] }).__ws.filter((s) => s.opened).length,
        ),
      { timeout: 20_000, message: 'the funding socket never reached OPEN' },
    )
    .toBeGreaterThan(0);

  const sockets = await page.evaluate(
    () => (window as unknown as { __ws: { url: string }[] }).__ws.map((s) => s.url),
  );
  expect(sockets.some((u) => u.startsWith('ws://') || u.startsWith('wss://')), `sockets: ${sockets.join(', ')}`).toBe(
    true,
  );

  const csp = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(csp.filter((v) => v.startsWith('connect-src'))).toEqual([]);
});
