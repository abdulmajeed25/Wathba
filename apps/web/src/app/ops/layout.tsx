import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { requireAdmin } from './_lib/guard';
import { OpsNav } from './_components/ops-nav';
import { CommandPalette } from './_components/command-palette';
import { ThemeToggle } from './_components/theme-toggle';
import { THEME_INIT_SCRIPT } from './_lib/theme';

/**
 * OPS Part 1/5 — مركز العمليات shell. Server-first: this layout re-runs the
 * ADMIN check on every request (middleware is the first gate, not the only
 * one). Deliberately austere and visually distinct from the public site —
 * an operator should always know which side of the glass they're on.
 *
 * Phase B (Unit 2) additions:
 *  - a11y landmarks: a visible-on-focus skip link + an <main id> target.
 *  - theme/density: the ops root carries data-theme/data-density, stamped
 *    pre-paint by THEME_INIT_SCRIPT (respects prefers-color-scheme, defaults
 *    dark) and driven by <ThemeToggle>. globals.css remaps the fixed palette
 *    and the --spacing token off those attributes (see the ops overrides
 *    block there) — no per-screen edits, dark look preserved as default.
 */
export const metadata: Metadata = {
  title: 'مركز العمليات — وثبة',
  robots: { index: false, follow: false, nocache: true },
};

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div
      id="ops-root"
      data-ops-root
      data-theme="dark"
      data-density="comfortable"
      suppressHydrationWarning
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-[#0d1117] text-[#e6edf3]"
    >
      {/* Pre-paint theme/density resolver — runs the instant this element is
          parsed, so there is no flash of the wrong appearance. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

      <a
        href="#ops-main"
        className="sr-only z-[60] rounded bg-[#238636] px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        تخطَّ إلى المحتوى
      </a>

      <header className="border-b border-[#21262d] bg-[#010409]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-sm font-bold tracking-wide">مركز عمليات وثبة</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <kbd className="hidden rounded border border-[#30363d] bg-[#161b22] px-2 py-0.5 text-[11px] text-[#8b949e] sm:inline-block">
              Ctrl+K للبحث
            </kbd>
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
              سطح داخلي — مراقَب ومسجَّل
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 md:flex-row">
        <aside className="shrink-0 md:w-52">
          <div className="md:sticky md:top-8">
            <OpsNav />
          </div>
        </aside>
        <main id="ops-main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
