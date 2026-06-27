import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Radius = 'card' | 'cardLg' | 'cardXl' | 'cardHero' | 'cardFeatured' | 'cardBand' | 'cardCta';

const RADIUS_CLASS: Record<Radius, string> = {
  card:          'rounded-(--radius-card)',          // 16
  cardLg:        'rounded-(--radius-card-lg)',       // 18 — most cards
  cardXl:        'rounded-(--radius-card-xl)',       // 20 — funding sidebar
  cardHero:      'rounded-(--radius-card-hero)',     // 22
  cardFeatured:  'rounded-(--radius-card-featured)', // 24 — featured project
  cardBand:      'rounded-(--radius-card-band)',     // 26
  cardCta:       'rounded-(--radius-card-cta)',      // 28
};

interface CardProps {
  children: ReactNode;
  className?: string;
  radius?: Radius;
  /** Add the lift/shadow + hover bounce (.lift utility from tokens.css). */
  lift?: boolean;
  /** Use the design's dark-mode gradient card surface. */
  surface?: boolean;
}

/**
 * Generic card. Defaults match the trending grid: radius 18, 1px ink-08 border,
 * surface-color background. Pass `radius` to bump per the design's usage table.
 */
export function Card({ children, className, radius = 'cardLg', lift = false, surface = true }: CardProps) {
  return (
    <div
      className={cn(
        RADIUS_CLASS[radius],
        'border',
        lift && 'lift',
        surface && 'bg-card',
        className,
      )}
      style={{
        borderColor: 'rgba(var(--ink-rgb),0.08)',
        ...(surface ? { background: 'var(--card)' } : {}),
      }}
    >
      {children}
    </div>
  );
}
