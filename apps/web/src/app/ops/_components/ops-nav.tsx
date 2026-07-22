import { OPS_SECTIONS } from '../_lib/sections';
import { NavLink } from './nav-link';

/**
 * OPS Part 5 — the side navigation over all 16 operator sections. Server
 * component (pure structure); each row is a small client island (NavLink)
 * that highlights the active route. Rendered by layout.tsx inside a
 * responsive shell — on tablet the layout collapses this into a scrollable
 * horizontal strip (see layout.tsx). Marked <nav> with an Arabic label so
 * assistive tech announces it.
 */
export function OpsNav() {
  return (
    <nav aria-label="أقسام مركز العمليات" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {OPS_SECTIONS.map((s) => (
        <NavLink key={s.href} href={s.href} labelAr={s.labelAr} />
      ))}
    </nav>
  );
}
