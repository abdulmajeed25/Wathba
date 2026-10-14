'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { OPS_SECTIONS } from '../_lib/sections';

/** The full operational taxonomy remains available without a horizontal hunt. */
export function ResponsiveNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = [...OPS_SECTIONS].sort((a, b) => b.href.length - a.href.length)
    .find(section => pathname === section.href || (section.href !== '/ops' && pathname.startsWith(`${section.href}/`)));
  useEffect(() => { setOpen(false); }, [pathname]);
  return <div onKeyDown={event => {
    if (event.key === 'Escape' && open) { setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls="ops-section-navigation"
      onClick={() => setOpen(value => !value)}
      className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-3 text-right text-sm focus-visible:outline-2 focus-visible:outline-[#58a6ff] md:hidden">
      <span><span className="block text-xs text-[#8b949e]">أقسام مركز العمليات</span><span className="font-bold">{current?.labelAr ?? 'اختر القسم'}</span></span>
      <span aria-hidden="true" className="text-lg">{open ? '−' : '+'}</span>
    </button>
    <div id="ops-section-navigation" className={`${open ? 'block' : 'hidden'} mt-3 md:mt-0 md:block`}
      onClick={event => { if (event.target instanceof Element && event.target.closest('a')) setOpen(false); }}>
      {children}
    </div>
  </div>;
}
