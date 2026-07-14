'use client';

import { useState } from 'react';

/**
 * OPS Part 4 — «الوكلاء» client actions: create (role-picked, reason-gated),
 * enable/disable, rotate token. Every action calls the registry through the
 * BFF; minted tokens render ONCE inside the session and are never persisted
 * anywhere client-side.
 */

export interface AgentRow {
  id: string;
  nameAr: string;
  isActive: boolean;
  roleKey: string;
  roleNameAr: string;
  hasToken: boolean;
  tokenExpiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

const ASSIGNABLE_ROLES = [
  'CONTENT_EDITOR',
  'REVIEWER',
  'MODERATOR',
  'ANALYST',
  'SUPPORT',
  'OPS_MANAGER',
  'FINANCE',
];

async function op(key: string, input: unknown, reason: string): Promise<Record<string, unknown>> {
  const r = await fetch(`/api/ops/operations/${key}/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input, reason }),
  });
  const body = (await r.json()) as Record<string, unknown>;
  if (!r.ok) {
    const msg =
      (body.message as string) ??
      ((body as { blockers?: Array<{ reasonAr: string }> }).blockers?.[0]?.reasonAr ?? 'فشل التنفيذ');
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body;
}

export function AgentsManager({ initial }: { initial: AgentRow[] }) {
  const [agents, setAgents] = useState(initial);
  const [nameAr, setNameAr] = useState('');
  const [roleKey, setRoleKey] = useState('CONTENT_EDITOR');
  const [reason, setReason] = useState('');
  const [minted, setMinted] = useState<{ agentId: string; token: string; expires: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await fetch('/api/ops/agents');
    if (r.ok) setAgents(((await r.json()) as { items: AgentRow[] }).items);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {minted ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="text-sm font-bold text-amber-300">
            رمز الخدمة — يُعرض هذه المرة فقط ولا يُخزَّن في أي مكان:
          </p>
          <code dir="ltr" className="mt-2 block break-all rounded bg-[#0d1117] p-3 font-mono text-xs text-amber-200">
            {minted.token}
          </code>
          <p className="mt-2 text-xs text-[#8b949e]">
            صالح حتى {new Date(minted.expires).toLocaleString('ar-SA')} — خزّنه في مدير أسرار ثم أغلق
            هذه الرسالة.
          </p>
          <button
            type="button"
            onClick={() => setMinted(null)}
            className="mt-3 rounded border border-[#30363d] px-3 py-1 text-xs hover:bg-[#21262d]"
          >
            أغلقت — خزّنته
          </button>
        </div>
      ) : null}

      <form
        className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const out = (await op('agents.create', { nameAr, roleKey }, reason)) as {
              result: { agentId: string; token: string; tokenExpiresAt: string };
            };
            setMinted({
              agentId: out.result.agentId,
              token: out.result.token,
              expires: out.result.tokenExpiresAt,
            });
            setNameAr('');
            setReason('');
          });
        }}
      >
        <h2 className="text-base font-bold sm:col-span-2">إنشاء وكيل</h2>
        <input
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          required
          minLength={3}
          placeholder="اسم الوكيل (مثال: وكيل مراجعة المحتوى)"
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        />
        <select
          value={roleKey}
          onChange={(e) => setRoleKey(e.target.value)}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm"
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={10}
          placeholder="السبب (١٠ أحرف على الأقل — يُسجَّل في التدقيق)"
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm sm:col-span-2"
        />
        <p className="text-xs text-[#8b949e] sm:col-span-2">
          OWNER ممنوع بنيوياً · المال ممنوع على الوكلاء مهما كان الدور — dryRun واقتراح فقط
        </p>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-[#238636] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#2ea043] disabled:opacity-50 sm:col-span-2"
        >
          إنشاء (يتطلب إعادة توثيق حديثة)
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              <th className="px-3 py-2 font-medium">الوكيل</th>
              <th className="px-3 py-2 font-medium">الدور</th>
              <th className="px-3 py-2 font-medium">الحالة</th>
              <th className="px-3 py-2 font-medium">الرمز</th>
              <th className="px-3 py-2 font-medium">آخر استخدام</th>
              <th className="px-3 py-2 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#8b949e]">
                  لا وكلاء بعد — أنشئ الأول أعلاه
                </td>
              </tr>
            ) : (
              agents.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">{a.nameAr}</td>
                  <td className="px-3 py-2">
                    <span className="rounded border border-[#30363d] px-1.5 py-0.5 text-[11px]">
                      {a.roleKey}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {a.isActive ? (
                      <span className="text-emerald-400">نشط</span>
                    ) : (
                      <span className="text-red-400">معطّل</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#8b949e]">
                    {a.tokenExpiresAt
                      ? `ينتهي ${new Date(a.tokenExpiresAt).toLocaleString('ar-SA')}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#8b949e]">
                    {a.lastUsedAt ? new Date(a.lastUsedAt).toLocaleString('ar-SA') : '—'}
                  </td>
                  <td className="space-x-2 space-x-reverse px-3 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const why = window.prompt('سبب التبديل (١٠ أحرف على الأقل):');
                        if (!why) return;
                        void run(async () => {
                          await op('agents.set-active', { agentId: a.id, isActive: !a.isActive }, why);
                        });
                      }}
                      className="rounded border border-[#30363d] px-2 py-1 text-xs hover:bg-[#21262d] disabled:opacity-50"
                    >
                      {a.isActive ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const why = window.prompt('سبب تدوير الرمز (١٠ أحرف على الأقل):');
                        if (!why) return;
                        void run(async () => {
                          const out = (await op('agents.token.rotate', { agentId: a.id }, why)) as {
                            result: { agentId: string; token: string; tokenExpiresAt: string };
                          };
                          setMinted({
                            agentId: out.result.agentId,
                            token: out.result.token,
                            expires: out.result.tokenExpiresAt,
                          });
                        });
                      }}
                      className="rounded border border-[#30363d] px-2 py-1 text-xs hover:bg-[#21262d] disabled:opacity-50"
                    >
                      تدوير الرمز
                    </button>
                    <a
                      href={`/ops/audit?actorType=AGENT&actorId=${encodeURIComponent(a.id)}`}
                      className="text-xs text-[#58a6ff] hover:underline"
                    >
                      سجلّه
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
