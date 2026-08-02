import { defineConfig } from '@playwright/test';

/**
 * Golden-journey E2E (Sprint 4 / P1-007).
 * Assumes: API on :4001 (stub PSP/Nafath), web prod build on :3123.
 * Run: pnpm exec playwright test
 */
/**
 * The session-rotation harness (:3124).
 *
 * Middleware's token-rotation block was unreachable from every test in this
 * suite: it fires only when the access token is within 5 minutes of its 1-hour
 * expiry, and no browser test can age a token. Three bugs accumulated there
 * unseen — the Secure flag, cookie persistence, and the ops-cookie teardown.
 *
 * So a SECOND instance of the same build runs with the rotation window widened
 * past the token's whole lifetime, which makes every request rotate. Playwright
 * owns its lifecycle, so it needs no change to ci.yml and behaves identically
 * locally and in CI.
 *
 * COOKIE_SECURE=0 is deliberate, and it is what gives session-rotation.spec.ts
 * its teeth: the rotated cookie must come back WITHOUT `Secure`. Anyone who
 * reverts that flag to the build-time NODE_ENV gets `Secure` back — a
 * production build always says production — and the spec fails. With
 * COOKIE_SECURE=1 both the correct and the broken code emit `Secure`, and the
 * assertion would prove nothing.
 *
 * Only ever hit with one request at a time: the refresh token is one-time use,
 * so the concurrent requests of a real page load would replay a consumed token
 * and kill the session. That spec uses `request`, never `page`.
 */
const ROTATION_PORT = 3124;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  retries: 1,
  workers: 1, // journeys share one DB — run serially
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3123',
    locale: 'ar-SA',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // The same standalone build the suite already runs on :3123 — CI boots
      // that one by hand, this one is ours.
      command: 'node .next/standalone/apps/web/server.js',
      env: {
        PORT: String(ROTATION_PORT),
        HOSTNAME: '127.0.0.1',
        SESSION_ROTATE_AHEAD_MS: String(2 * 60 * 60 * 1000), // > the 1h token life
        COOKIE_SECURE: '0',
      },
      url: `http://127.0.0.1:${ROTATION_PORT}/projects`,
      // Reuse while iterating locally, NEVER in CI. A server left over from an
      // earlier build keeps serving the code it started with, and a test that
      // silently runs against stale code is worse than one that fails.
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  reporter: [['list']],
});
