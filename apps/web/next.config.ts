import type { NextConfig } from 'next';

import { validateEnv } from './src/lib/env';

// STAKES/Q4 — fail the PRODUCTION build loudly on a missing/malformed
// NEXT_PUBLIC_* (dev warns and continues on localhost fallbacks).
validateEnv();

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy.
 *
 * - `unsafe-inline` for script/style is required by Next's inline runtime
 *   scripts and this codebase's inline `style={{}}` usage; tightening to
 *   nonces is follow-up work (logged in the audit as P2).
 * - `unsafe-eval` is dev-only (React Refresh needs it).
 * - Moyasar hosts are pre-allowlisted so the hosted-checkout integration
 *   (P0-305, Sprint 1) does not need a header change.
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://cdn.moyasar.com`,
  `style-src 'self' 'unsafe-inline' https://cdn.moyasar.com`,
  `img-src 'self' data: blob: https:`,
  `media-src 'self' blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://api.moyasar.com ${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}`,
  `frame-src https://api.moyasar.com https://cdn.moyasar.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=(self)' },
];

const config: NextConfig = {
  reactStrictMode: true,
  // Slim Docker runtime (Sprint 4 / P0-1101).
  output: 'standalone',
  // STAKES/M2 — next/image for real remote assets (MinIO avatars/covers).
  // `unoptimized`: the standalone runtime ships without sharp; next/image
  // still gives lazy-loading + enforced dimensions (no CLS), which is what
  // the audit item measured. Flip this off once sharp lands in the image.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '161.97.150.122' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default config;
