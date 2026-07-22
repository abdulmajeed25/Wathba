import type { ReactNode } from 'react';

/**
 * OPS Part 5 — the shared badge vocabulary, extracted from page.tsx's inline
 * maps so every entity page pills tiers/status identically. Pure presentation
 * (server-renderable). GitHub-dark palette; RTL-safe.
 */

export type RiskTier = 'CONTENT' | 'STANDARD' | 'SENSITIVE' | 'MONEY';

const TIER_STYLE: Record<RiskTier, string> = {
  MONEY: 'border-red-500/40 bg-red-500/10 text-red-300',
  SENSITIVE: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  STANDARD: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  CONTENT: 'border-[#30363d] bg-[#161b22] text-[#8b949e]',
};

/** Generic pill — the base every badge below shares. */
export function Badge({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] leading-none ${className}`}
    >
      {children}
    </span>
  );
}

/** Risk-tier badge — falls back to CONTENT styling for unknown tiers. */
export function RiskTierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return <span className="text-[#484f58]">—</span>;
  const style = TIER_STYLE[tier as RiskTier] ?? TIER_STYLE.CONTENT;
  return <Badge className={style}>{tier}</Badge>;
}

/** Status intents map onto the same four hues (plus a positive/green). */
export type StatusIntent = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

const STATUS_STYLE: Record<StatusIntent, string> = {
  ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  danger: 'border-red-500/40 bg-red-500/10 text-red-300',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  muted: 'border-[#30363d] bg-[#161b22] text-[#8b949e]',
};

export function StatusBadge({
  intent = 'muted',
  children,
}: {
  intent?: StatusIntent;
  children: ReactNode;
}) {
  return <Badge className={STATUS_STYLE[intent]}>{children}</Badge>;
}
