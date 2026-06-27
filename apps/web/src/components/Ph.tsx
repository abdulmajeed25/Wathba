import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * "Photo holder" pattern — the design's image stand-in.
 * Solid `--ph-bg` with diagonal 135° accent-tinted stripes (2px on 9px gap).
 *
 * Pass `icon` to render a centered icon ABOVE the label — used by the
 * project-detail gallery for the play_circle overlay (design line 524).
 */
export function Ph({
  className,
  children,
  label,
  icon: Icon,
  iconSize = 46,
}: {
  className?: string;
  children?: ReactNode;
  label?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  iconSize?: number;
}) {
  return (
    <div className={cn('ph relative overflow-hidden', className)}>
      {(label || Icon) && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center">
            {Icon && (
              <Icon
                width={iconSize}
                height={iconSize}
                style={{ color: 'var(--ph-label)' }}
              />
            )}
            {label && (
              <span
                className={cn(
                  'num text-[12px] tracking-[1px] text-ph-label',
                  Icon && 'mt-[8px]',
                )}
              >
                [ {label} ]
              </span>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
