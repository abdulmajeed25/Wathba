import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { requireAdmin } from './_lib/guard';
import { OpsNav } from './_components/ops-nav';
import { CommandPalette } from './_components/command-palette';

/**
 * OPS Part 1/5 — مركز العمليات shell. Server-first: this layout re-runs the
 * ADMIN check on every request (middleware is the first gate, not the only
 * one). Deliberately austere and visually distinct from the public site —
 * an operator should always know which side of the glass they're on.
 *
 * Part 5 adds the responsive two-column shell: the 16-section side nav
 * (a scrollable horizontal strip on tablet, a fixed rail on desktop) and the
 * Ctrl+K command palette, both mounted here so every screen inherits them.
 */
export const metadata: Metadata = {
  title: 'مركز العمليات — وثبة',
  robots: { index: false, follow: false, nocache: true },
};

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <header className="border-b border-[#21262d] bg-[#010409]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-sm font-bold tracking-wide">مركز عمليات وثبة</span>
          </div>
          <div className="flex items-center gap-3">
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
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}
