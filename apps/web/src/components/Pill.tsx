import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'accent' | 'gold' | 'pos' | 'purple' | 'blue' | 'muted' | 'partner';

const TONE_RGB: Record<Tone, string> = {
  accent:  'var(--accent-rgb)',
  gold:    '251,191,36',
  pos:     '52,211,153',
  purple:  '109,77,240',
  blue:    '37,99,235',
  muted:   'var(--ink-rgb)',
  partner: '109,77,240',
};

const TONE_COLOR: Record<Tone, string> = {
  accent:  'var(--accent)',
  gold:    'var(--gold)',
  pos:     'var(--pos)',
  purple:  'var(--purple)',
  blue:    'var(--blue)',
  muted:   'var(--muted)',
  partner: 'var(--purple)',
};

/**
 * Tinted pill — used for status badges, top-corner chips, and the §7
 * "بشراكة وثبة" disclosure.
 */
export function Pill({
  tone = 'accent',
  withDot = false,
  className,
  children,
  size = 'md',
}: {
  tone?: Tone;
  withDot?: boolean;
  className?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const padding =
    size === 'sm' ? 'px-[10px] py-[5px] text-[11px]'
    : size === 'lg' ? 'px-[15px] py-[8px] text-[13.5px]'
    : 'px-[15px] py-[7px] text-[13px]';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[8px] rounded-(--radius-pill) border font-bold',
        padding,
        className,
      )}
      style={{
        background: `rgba(${TONE_RGB[tone]},0.10)`,
        borderColor: `rgba(${TONE_RGB[tone]},0.30)`,
        color: TONE_COLOR[tone],
      }}
    >
      {withDot && (
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: TONE_COLOR[tone] }} />
      )}
      {children}
    </span>
  );
}
