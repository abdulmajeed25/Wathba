import type { ReactNode } from 'react';

import { StatusBadge, type StatusIntent } from './badge';

/**
 * OPS Part 5 — a work-queue summary card (e.g. «مراجعات معلّقة», «اقتراحات
 * بانتظار الاعتماد»). Server-renderable; the count is emphasised and the card
 * links to the queue. `intent` colours the count when attention is needed.
 */
export function QueueCard({
  title,
  count,
  href,
  intent = 'muted',
  badgeAr,
  children,
}: {
  title: string;
  count: number;
  href: string;
  intent?: StatusIntent;
  /** Optional pill (e.g. «عاجل») rendered next to the title. */
  badgeAr?: string;
  /** Optional preview rows / description under the count. */
  children?: ReactNode;
}) {
  const countColor =
    count === 0
      ? 'text-[#484f58]'
      : intent === 'danger'
        ? 'text-red-300'
        : intent === 'warn'
          ? 'text-amber-300'
          : intent === 'ok'
            ? 'text-emerald-300'
            : 'text-[#e6edf3]';

  return (
    <a
      href={href}
      className="block rounded-lg border border-[#21262d] bg-[#161b22] p-4 transition-colors hover:border-[#30363d] hover:bg-[#1c2128] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {badgeAr ? <StatusBadge intent={intent}>{badgeAr}</StatusBadge> : null}
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${countColor}`}>
        {count.toLocaleString('ar-SA')}
      </p>
      {children ? <div className="mt-2 text-xs text-[#8b949e]">{children}</div> : null}
    </a>
  );
}
