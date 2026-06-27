import type { Metadata } from 'next';
import { Reem_Kufi, Tajawal, IBM_Plex_Sans_Arabic } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const reemKufi = Reem_Kufi({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-reem-kufi',
  display: 'swap',
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'وثبة', template: '%s' },
  description: 'وثبة — منصة دعم المشاريع الإبداعية بضمان التنفيذ',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${reemKufi.variable} ${tajawal.variable} ${ibmPlexArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
