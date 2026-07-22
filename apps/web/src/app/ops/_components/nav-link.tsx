'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * OPS Part 5 — one nav row. A tiny client island so the server OpsNav can
 * stay a server component: it reads the pathname to mark the active section.
 * `/ops` matches only exactly (every other route starts with it).
 */
export function NavLink({ href, labelAr }: { href: string; labelAr: string }) {
  const pathname = usePathname();
  const active = href === '/ops' ? pathname === '/ops' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'block rounded px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]',
        active
          ? 'bg-[#21262d] font-bold text-[#e6edf3]'
          : 'text-[#8b949e] hover:bg-[#161b22] hover:text-[#e6edf3]',
      ].join(' ')}
    >
      {labelAr}
    </Link>
  );
}
