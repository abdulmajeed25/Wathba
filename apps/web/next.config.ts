import type { NextConfig } from 'next';

import { validateEnv } from './src/lib/env';

// STAKES/Q4 — fail the PRODUCTION build loudly on a missing/malformed
// NEXT_PUBLIC_* (dev warns and continues on localhost fallbacks).
validateEnv();

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Project media (covers, story images, story video) is served by MinIO, which
 * this demo exposes over PLAIN HTTP on :9000. The `https:` source in img-src
 * and media-src below covers a TLS deployment and does nothing for that origin,
 * so every cover was blocked — and the failure misleads in a way worth naming:
 * the browser issues NO request at all, so the NETWORK tab is empty and the
 * <img> reports complete === true with naturalWidth === 0, which reads exactly
 * like a missing file. The CONSOLE does say so (Chromium logs the violation and
 * fires `securitypolicyviolation` with effectiveDirective), so the rule is:
 * an empty network tab plus a broken image means look at the console, not at
 * the bucket.
 *
 * It belongs in BOTH directives. img-src governs the cover and the story image;
 * media-src governs <video>, which wathba-start.tsx points at `res.publicUrl` —
 * the MinIO origin, not a blob: URL — so the story-video preview fails the same
 * silent way an image does. One directive without the other fixes half of it.
 *
 * Derived from the environment rather than hardcoded, and empty when unset, so
 * an HTTPS deployment adds nothing to the policy. Same shape as the
 * connect-src exception for the API origin below.
 */
const mediaOrigin = process.env.NEXT_PUBLIC_MEDIA_URL ? ` ${process.env.NEXT_PUBLIC_MEDIA_URL}` : '';

/**
 * The realtime funding socket.
 *
 * use-live-funding.ts opens a socket.io connection to the API origin, which the
 * browser dials as ws:// (or wss:// behind TLS). CSP treats that as its own
 * scheme, and Chromium does NOT accept the http: source below as covering it —
 * verified against the running deployment, where every campaign page logged
 * "connect-src blocked ws://...:4000/socket.io/". So the live funding rail was
 * silently frozen on every project page.
 *
 * Silently, in the fullest sense: socket.io lists polling as a fallback
 * transport, so the natural assumption is that it degrades to HTTP and keeps
 * working. It does not — no polling request is ever made, because the failure
 * arrives as a connection error that socket.io retries on the websocket
 * transport. Checked before writing this, rather than assumed.
 *
 * Derived from the API origin rather than listed separately, so the two cannot
 * drift, and http -> ws / https -> wss keeps a TLS deployment correct.
 */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const apiWsOrigin = apiOrigin.replace(/^http/, 'ws');

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
  `img-src 'self' data: blob: https:${mediaOrigin}`,
  `media-src 'self' blob: https:${mediaOrigin}`,
  `font-src 'self' data:`,
  // The media origin belongs here too: a browser upload PUTs directly to it,
  // which is a fetch and therefore connect-src, not img-src.
  `connect-src 'self' https://api.moyasar.com ${apiOrigin} ${apiWsOrigin}${mediaOrigin}`,
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
      // HOME-REVIEW O3 — /projects/v2030 was an ORPHAN that search engines were
      // told to index: declared in sitemap.ts, linked from no page on the site,
      // and rendering FIXTURE_SECTORS — six English sector names (Tourism,
      // Health, Energy, Logistics, Education, AgriTech) on an Arabic-first RTL
      // platform, in the pre-Wathba design system. A visitor arriving from
      // Google landed on fabricated content with no way in or back.
      //
      // Redirected rather than deleted, because it is the one of the three that
      // Google may already have indexed: a 301 carries that traffic to the real
      // discovery surface instead of serving it a 404 until the next crawl. The
      // sitemap entry is gone, so nothing re-declares it. Vision 2030 alignment
      // can be rebuilt on live data later; this only stops the site from
      // publishing demo data under its own name.
      { source: '/projects/v2030', destination: '/projects/discover-all', permanent: true },
      { source: '/projects/v2030/:sector', destination: '/projects/discover-all', permanent: true },
    ];
  },
};

export default config;
