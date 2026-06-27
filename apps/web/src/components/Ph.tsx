import { cn } from '@/lib/cn';

/**
 * "Photo holder" pattern — the design's image stand-in.
 * Solid `--ph-bg` with diagonal 135° accent-tinted stripes (2px on 9px gap).
 */
export function Ph({
  className,
  children,
  label,
}: {
  className?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className={cn('ph relative overflow-hidden', className)}>
      {label && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="num text-[12px] tracking-[1px] text-ph-label">[ {label} ]</span>
        </div>
      )}
      {children}
    </div>
  );
}
