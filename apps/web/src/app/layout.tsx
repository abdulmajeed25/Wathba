import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';
import { SITE_URL } from '@/lib/site';

/* STAKES/S-14 (M1) — Reem Kufi + Tajawal were preloaded (7 files) but
 * consumed NOWHERE (--font-display/--font-body had zero users): pure LCP
 * tax on throttled mobile. Removed. */
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
  // STAKES/S-14 (M1/F-09) — 'optional': the late Arabic-font swap reflowed
  // the whole page (CLS ~0.5 on throttled mobile). With 'optional', a slow
  // first visit keeps the system Arabic fallback (no mid-read reflow);
  // cached + fast connections still paint the brand face.
  display: 'optional',
});

// STAKES/S-2/M6 — the numeric face (`.num` / <Num/>) was referenced by CSS name
// only and silently fell back to sans-serif app-wide. Load it for real.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

/** STAKES/Q1 — brand theme-color for the browser chrome (both schemes). */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#05a661' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1512' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'وثبة', template: '%s' },
  description: 'وثبة — منصة دعم المشاريع الإبداعية بضمان التنفيذ',
  alternates: { canonical: './' },
  openGraph: {
    siteName: 'وثبة — WATHBA',
    locale: 'ar_SA',
    type: 'website',
    // STAKES/S-10 F-04 — brand card so media-less pages still unfurl with an image.
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};

/** STAKES/N5 — sitewide Organization markup. */
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'وثبة',
  alternateName: 'WATHBA',
  url: SITE_URL,
  description: 'منصة سعودية للدعم الجماعي تجمع المبدعين بمجتمعٍ يؤمن بأفكارهم — بشفافية وضمان تنفيذ.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmPlexArabic.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        {children}
      </body>
    </html>
  );
}
