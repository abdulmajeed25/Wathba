import { defineConfig } from '@playwright/test';

/**
 * Golden-journey E2E (Sprint 4 / P1-007).
 * Assumes: API on :4001 (stub PSP/Nafath), web prod build on :3123.
 * Run: pnpm exec playwright test
 */
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
  reporter: [['list']],
});
