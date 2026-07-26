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
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://cdn.moyasar.com https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline' https://cdn.moyasar.com`,
  `img-src 'self' data: blob: https:`,
  `media-src 'self' blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://api.moyasar.com ${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}`,
  `frame-src https://api.moyasar.com https://cdn.moyasar.com https://challenges.cloudflare.com`,
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

/**
 * STAKES/S-10 F-02 — bots that must receive BLOCKING metadata in <head>.
 * Dynamic pages stream their metadata into <body> for regular browsers (JS
 * hoists it), but non-JS link-preview scrapers only read <head>. Next's
 * default list already covers WhatsApp/Twitter/Telegram/Facebook/Slack/
 * Discord/LinkedIn (live-verified); setting `htmlLimitedBots` REPLACES that
 * default, so this regex = Next's default + the previewers it misses.
 */
const htmlLimitedBots =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|Snapchat|Viber|Pinterest|Mastodon|Bluesky|SignalBot|iframely|Embedly|TelegramBot/i;

const config: NextConfig = {
  reactStrictMode: true,
  htmlLimitedBots,
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
  // Batch SEARCH Part 1 — CANONICAL DISCOVERY URL: /projects/discover-all is
  // THE discovery page («اكتشف», mega-menu + advanced filters). The old
  // «استكشف» category index /projects/discover is retired with a permanent
  // redirect; per-category landing pages (/projects/discover/[catSlug])
  // remain as children of the canonical discovery surface (URLs preserved
  // for SEO).
  async redirects() {
    return [
      { source: '/projects/discover', destination: '/projects/discover-all', permanent: true },
      // Batch POLISH Unit 1 — «تحت الأضواء» became a page of its own. Anything
      // that used to reach the curated surface through a pre-filtered discovery
      // URL now lands on /spotlight, permanently.
      { source: '/projects/spotlight', destination: '/spotlight', permanent: true },
      {
        source: '/projects/discover-all',
        has: [{ type: 'query', key: 'collection', value: 'women-creators' }],
        destination: '/spotlight',
        permanent: true,
      },
    ];
  },
};

export default config;
