import { cn } from '@/lib/cn';

interface Props {
  /** 0..1 (clamped). */
  pct: number;
  /** Bar height in px. Design uses 6 on cards, 9 on funding sidebar. */
  height?: number;
  /** Track alpha — design uses 0.08 on cards, 0.06 on transparency dashboard. */
  trackAlpha?: number;
  /** Use the "over 100%" fill (light: #05c074→#10b04f). */
  over?: boolean;
  className?: string;
}

export function ProgressBar({ pct, height = 9, trackAlpha = 0.08, over, className }: Props) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div
      className={cn('overflow-hidden rounded-(--radius-pill)', className)}
      style={{ height, background: `rgba(var(--ink-rgb),${trackAlpha})` }}
    >
      <div
        className="h-full rounded-(--radius-pill)"
        style={{
          width: `${p * 100}%`,
          background: over ? 'var(--grad-bar-over)' : 'var(--grad-bar)',
          transition: 'width 1.4s cubic-bezier(.2,.7,.2,1)',
        }}
      />
    </div>
  );
}
