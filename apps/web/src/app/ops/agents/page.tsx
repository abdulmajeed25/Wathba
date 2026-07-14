import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { AgentsManager, type AgentRow } from './agents-manager';

/**
 * OPS Part 4 — «الوكلاء»: create/disable agents, rotate tokens, see the
 * kill-switch state, jump to each agent's audit trail. Management actions
 * are agents.* OPERATIONS (SENSITIVE — step-up + reason), never raw edits.
 */
export default async function OpsAgentsPage() {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();

  let items: AgentRow[] = [];
  let agentsEnabled = true;
  let refused = false;
  try {
    const r = await fetch(`${API_BASE}/v1/ops/agents`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (r.status === 403) refused = true;
    if (r.ok) {
      const body = (await r.json()) as { agentsEnabled: boolean; items: AgentRow[] };
      items = body.items;
      agentsEnabled = body.agentsEnabled;
    }
  } catch {
    /* API unreachable — the page renders the refused/empty states */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">الوكلاء</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            هوية من الدرجة الأولى بدور مقيّد — لا OWNER، لا مال، لا تنفيذ أعمى. العقد الكامل في
            docs/agents.md
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {agentsEnabled ? (
        <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          واجهة الوكلاء تعمل — الإيقاف الشامل الفوري: AGENTS_ENABLED=false (متغير بيئة، يقتل كل
          الرموز لحظياً)
        </p>
      ) : (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300">
          مفتاح الإيقاف الشامل مفعّل (AGENTS_ENABLED=false) — كل رموز الوكلاء مرفوضة الآن
        </p>
      )}

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية agents.manage — إدارة الوكلاء للمالك.
        </p>
      ) : (
        <AgentsManager initial={items} />
      )}
    </div>
  );
}
