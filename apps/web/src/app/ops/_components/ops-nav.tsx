import { cookies } from 'next/headers';

import { API_BASE, OPS_COOKIE } from '../_lib/guard';
import { OPS_GROUPS, type BadgeKey } from '../_lib/sections';
import { NavLink } from './nav-link';

/**
 * OPS Phase B (Unit 2) — the grouped operator navigation.
 *
 * Server component: it renders the 7-cluster taxonomy (see _lib/sections.ts)
 * with a heading per group, and — crucially — fetches the ops dashboard ONCE
 * here to hang live "N need me" counts off the sections that carry a worklist
 * (money / projects-under-review / open reports / open tickets). The fetch is
 * best-effort: any failure (no ops session yet, API down) just drops the
 * badges; the nav still renders. Each row stays a small NavLink client island
 * for the active-route highlight.
 */

interface WorkQueue {
  projectsUnderReview: number;
  payoutsPending: number;
  payoutsFailed: number;
  reportsOpen: number;
  ticketsOpen: number;
}

type Badge = { count: number; intent: 'warn' | 'danger' };

async function loadCounts(): Promise<Partial<Record<BadgeKey, Badge>>> {
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  if (!token) return {};
  try {
    const r = await fetch(`${API_BASE}/v1/ops/dashboard`, {
      headers: { 'x-ops-token': token },
      cache: 'no-store',
    });
    if (!r.ok) return {};
    const wq = ((await r.json()) as { workQueue?: WorkQueue }).workQueue;
    if (!wq) return {};
    const moneyCount = (wq.payoutsPending ?? 0) + (wq.payoutsFailed ?? 0);
    const out: Partial<Record<BadgeKey, Badge>> = {};
    if (wq.projectsUnderReview > 0)
      out.projectsUnderReview = { count: wq.projectsUnderReview, intent: 'warn' };
    if (moneyCount > 0)
      out.money = { count: moneyCount, intent: wq.payoutsFailed > 0 ? 'danger' : 'warn' };
    if (wq.reportsOpen > 0) out.reportsOpen = { count: wq.reportsOpen, intent: 'warn' };
    if (wq.ticketsOpen > 0) out.ticketsOpen = { count: wq.ticketsOpen, intent: 'warn' };
    return out;
  } catch {
    return {};
  }
}

export async function OpsNav() {
  const counts = await loadCounts();

  return (
    <nav
      aria-label="أقسام مركز العمليات"
      className="flex gap-4 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible"
    >
      {OPS_GROUPS.map((group) => (
        <div key={group.labelAr} className="shrink-0 md:shrink">
          <h2 className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-[#484f58]">
            {group.labelAr}
          </h2>
          <div className="flex gap-1 md:flex-col">
            {group.items.map((s) => (
              <NavLink
                key={s.href}
                href={s.href}
                labelAr={s.labelAr}
                badge={s.badgeKey ? counts[s.badgeKey] : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
