import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from 'next/font/google';
import { Providers } from '@/providers/Providers';
import { THEME_BOOT_SCRIPT } from '@/providers/ThemeProvider';
import './globals.css';

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'وثبة — Wathba',
  description: 'منصة الدعم الجماعي الأولى عربياً — حوّل فكرتك إلى واقعٍ ملموس',
  applicationName: 'Wathba',
  authors: [{ name: 'Wathba' }],
  keywords: ['crowdfunding', 'KSA', 'Arabic', 'وثبة', 'دعم جماعي'],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1422' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${arabic.variable} ${grotesk.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
