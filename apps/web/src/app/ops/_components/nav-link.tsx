'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * OPS Part 5 / Phase B — one nav row. A tiny client island so the grouped
 * server OpsNav can stay a server component: it reads the pathname to mark the
 * active section. `/ops` matches only exactly (every other route starts with
 * it). Phase B adds an optional live-count badge ("N need me") resolved by the
 * server nav and passed down; the count is also announced to assistive tech so
 * colour is never the only signal.
 */
export function NavLink({
  href,
  labelAr,
  badge,
}: {
  href: string;
  labelAr: string;
  badge?: { count: number; intent: 'warn' | 'danger' };
}) {
  const pathname = usePathname();
  const active = href === '/ops' ? pathname === '/ops' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center justify-between gap-2 rounded px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]',
        active
          ? 'bg-[#21262d] font-bold text-[#e6edf3]'
          : 'text-[#8b949e] hover:bg-[#161b22] hover:text-[#e6edf3]',
      ].join(' ')}
    >
      <span>{labelAr}</span>
      {badge ? (
        // Visual count only (aria-hidden): the number is a redundant, non-colour
        // signal for WCAG 1.4.1, and kept out of the link's accessible name so
        // the name stays exactly the section label. Live totals live on the
        // board that the link opens.
        <span
          aria-hidden="true"
          title={`${badge.count.toLocaleString('ar-SA')} عنصرًا بانتظارك`}
          className={[
            'min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums',
            badge.intent === 'danger'
              ? 'border border-red-500/50 bg-red-500/15 text-red-300'
              : 'border border-amber-500/50 bg-amber-500/15 text-amber-300',
          ].join(' ')}
        >
          {badge.count.toLocaleString('ar-SA')}
        </span>
      ) : null}
    </Link>
  );
}
