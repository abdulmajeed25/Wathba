import type { MetadataRoute } from 'next';

/** STAKES/Q1 — installable-PWA basics: name, colors, icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'وثبة — منصة دعم المشاريع الإبداعية',
    short_name: 'وثبة',
    description: 'منصة سعودية للدعم الجماعي بضمان تنفيذ.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/projects',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#05a661',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
