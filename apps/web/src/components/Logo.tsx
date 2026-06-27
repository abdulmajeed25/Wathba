import Link from 'next/link';
import { Rocket } from 'lucide-react';

/**
 * Brand mark. Matches design WATHBAوثبة.dc.html header:
 *   42×42 rounded-13 gradient box with rocket FILL=1 at 26px on-accent,
 *   logo shadow `0 8px 22px -8px rgba(accent,0.7)`,
 *   stacked label: "وثبة" 19/700 LS -0.3, "LEAP FORWARD" 9.5 LS 3 muted-2.
 */
export function Logo() {
  return (
    <Link href="/" className="flex flex-shrink-0 items-center gap-[11px]">
      <div
        className="grid h-[42px] w-[42px] place-items-center overflow-hidden rounded-(--radius-brand)"
        style={{ background: 'var(--grad)', boxShadow: 'var(--shadow-logo)', color: 'var(--on-accent)' }}
      >
        <Rocket strokeWidth={2.4} className="h-[26px] w-[26px]" />
      </div>
      <div className="leading-[1.05]">
        <div className="text-[19px] font-bold tracking-[-0.3px] text-text">وثبة</div>
        <div className="num text-[9.5px] tracking-[3px] text-muted-2">LEAP FORWARD</div>
      </div>
    </Link>
  );
}
