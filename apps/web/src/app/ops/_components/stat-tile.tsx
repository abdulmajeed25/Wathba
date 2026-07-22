import type { ReactNode } from 'react';

/**
 * OPS Part 5 — a single dashboard KPI. Server-renderable. Money callers pass
 * an already-formatted SAR string (use `formatSar` from _lib/money). An
 * optional `href` turns the whole tile into a keyboard-reachable link.
 */
export function StatTile({
  label,
  value,
  hint,
  href,
  intent = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  intent?: 'default' | 'ok' | 'warn' | 'danger';
}) {
  const ring =
    intent === 'ok'
      ? 'border-emerald-500/30'
      : intent === 'warn'
        ? 'border-amber-500/30'
        : intent === 'danger'
          ? 'border-red-500/30'
          : 'border-[#21262d]';

  const body = (
    <>
      <p className="text-xs text-[#8b949e]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[#484f58]">{hint}</p> : null}
    </>
  );

  const base = `block rounded-lg border bg-[#161b22] p-4 ${ring}`;
  if (href) {
    return (
      <a
        href={href}
        className={`${base} transition-colors hover:border-[#30363d] hover:bg-[#1c2128] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]`}
      >
        {body}
      </a>
    );
  }
  return <div className={base}>{body}</div>;
}
