import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { requireAdmin } from './_lib/guard';

/**
 * OPS Part 1 — مركز العمليات shell. Server-first: this layout re-runs the
 * ADMIN check on every request (middleware is the first gate, not the only
 * one). Deliberately austere and visually distinct from the public site —
 * an operator should always know which side of the glass they're on.
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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-sm font-bold tracking-wide">مركز عمليات وثبة</span>
          </div>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
            سطح داخلي — مراقَب ومسجَّل
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
