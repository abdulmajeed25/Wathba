import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/** STAKES/N3 — crawlers stay out of the private/gated surfaces. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/projects/admin',
          '/projects/dashboard',
          '/projects/settings',
          '/projects/me',
          '/projects/supplier',
          '/projects/submit',
          '/projects/payments',
          '/sign-in',
          '/sign-up',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
