import Link from 'next/link';

import { WathbaThemeRoot } from '@/components/ventures/wathba/wathba-theme-root';

/**
 * Batch PAGE-PARITY U2 — the auth pages join the platform.
 *
 * Six routes (sign-in, sign-up, sign-up/nafath, forgot-password,
 * reset-password, verify-email) rendered outside the design system entirely:
 * no `data-theme`, no palette, no mark. A reader who had chosen dark got a
 * white page, and the first screen a new user ever sees carried nothing that
 * said Wathba.
 *
 * The THEME ROOT, not the full `WathbaShell`: an auth page deliberately has no
 * site header, no category strip and no footer — a sign-in form should not
 * offer twenty ways to leave it. What it does need is the palette and a way
 * home, which is what this adds.
 *
 * The pages themselves keep their Tailwind utilities; those now resolve through
 * the token-aware theme keys in globals.css (`text-fg-muted`, `bg-brand`,
 * `text-brand-ink`, `border-edge`), which re-resolve inside this scope. That is
 * why the palette follows the theme without every page being rewritten.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <WathbaThemeRoot style={{ display: 'flex', flexDirection: 'column' }}>
      {/* The only chrome an auth page gets: the mark, and a way back. It is a
       *  LINK rather than a header so it cannot grow into a nav bar later. */}
      <div style={{ padding: '22px 24px 0' }}>
        <Link
          href="/projects"
          aria-label="وثبة — الصفحة الرئيسية"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'var(--text-primary)',
            // WCAG 2.5.8 — the mark is the only escape from this page.
            minHeight: 24,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--grad)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--on-accent)',
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            و
          </span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>وثبة</span>
        </Link>
      </div>
      {children}
    </WathbaThemeRoot>
  );
}
