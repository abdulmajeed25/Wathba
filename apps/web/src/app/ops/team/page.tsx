import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { StatTile } from '../_components/stat-tile';
import { TeamManager, type DirUser } from './team-manager';

/**
 * OPS Phase 2 — «فريق العمل والأدوار» (section 16). The RBAC control surface:
 *  · a READ-ONLY mirror of the 8-role × permission matrix (source of truth is
 *    apps/api/src/ops/permissions.ts ROLE_MATRIX — mirrored here as static
 *    data; parity is asserted server-side by ops-rbac.spec.ts).
 *  · the live four-eyes state (from /v1/ops/auth/session).
 *  · a governed grant/revoke surface for ops + product roles (client island).
 * OWNER-only actions are gated by the session's own permissions.
 */

/** Permission keys in catalog order — mirrors ALL_PERMISSIONS. */
const PERMISSION_KEYS = [
  'projects.review',
  'projects.feature',
  'projects.lifecycle',
  'moderation.queue',
  'users.lifecycle',
  'users.pii.unmask',
  'users.roles.assign',
  'money.execute',
  'money.approve',
  'content.editorial',
  'content.collections',
  'content.categories',
  'agents.manage',
  'settings.write',
  'support.tickets',
  'analytics.read',
  'audit.read',
] as const;

/** The 8 seeded roles — mirror of ROLE_MATRIX ('*' = OWNER, matches all). */
const ROLE_MATRIX: Array<{ key: string; nameAr: string; permissions: readonly string[] }> = [
  { key: 'OWNER', nameAr: 'المالك', permissions: ['*'] },
  {
    key: 'OPS_MANAGER',
    nameAr: 'مدير العمليات',
    permissions: [
      'projects.review',
      'projects.feature',
      'projects.lifecycle',
      'moderation.queue',
      'users.lifecycle',
      'content.editorial',
      'content.collections',
      'content.categories',
      'support.tickets',
      'analytics.read',
      'audit.read',
    ],
  },
  { key: 'REVIEWER', nameAr: 'مراجع مشاريع', permissions: ['projects.review'] },
  {
    key: 'FINANCE',
    nameAr: 'المالية',
    permissions: ['money.execute', 'money.approve', 'analytics.read', 'audit.read'],
  },
  {
    key: 'SUPPORT',
    nameAr: 'الدعم',
    permissions: ['users.lifecycle', 'users.pii.unmask', 'support.tickets'],
  },
  { key: 'MODERATOR', nameAr: 'الثقة والسلامة', permissions: ['moderation.queue'] },
  {
    key: 'CONTENT_EDITOR',
    nameAr: 'محرر المحتوى',
    permissions: ['content.editorial', 'content.collections', 'content.categories'],
  },
  { key: 'ANALYST', nameAr: 'محلل بيانات', permissions: ['analytics.read', 'audit.read'] },
];

function roleHas(perms: readonly string[], key: string): boolean {
  return perms.includes('*') || perms.includes(key);
}

interface SessionInfo {
  fourEyes: boolean;
  moneyAdmins: number;
  roleKeys: string[];
  permissions: string[];
}

export default async function OpsTeamPage() {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();

  let users: DirUser[] = [];
  let usersRefused = false;
  let session: SessionInfo | null = null;

  try {
    const [usersRes, sessionRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/users?limit=100`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/v1/ops/auth/session`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
    ]);
    if (usersRes.status === 403) usersRefused = true;
    if (usersRes.ok) users = ((await usersRes.json()) as { items: DirUser[] }).items;
    if (sessionRes.ok) session = (await sessionRes.json()) as SessionInfo;
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  const perms = session?.permissions ?? [];
  const isOwner = (session?.roleKeys ?? []).includes('OWNER') || perms.includes('*');
  const canGrantOps = perms.includes('*') || perms.includes('users.roles.assign');
  const canGrantProduct = perms.includes('*') || perms.includes('users.lifecycle');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">فريق العمل والأدوار</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            منح وسحب أدوار العمليات وأدوار المنتج — ومصفوفة الأدوار×الصلاحيات للاطلاع
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {/* four-eyes status */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="حالة الأربع أعين للمال"
          value={session ? (session.fourEyes ? 'مفعّلة' : 'غير مفعّلة') : '—'}
          intent={session?.fourEyes ? 'ok' : 'warn'}
          hint="تُفعَّل تلقائياً عند ثاني مشرف مالي"
        />
        <StatTile
          label="عدد المشرفين الماليين"
          value={session ? session.moneyAdmins.toLocaleString('ar-SA-u-nu-latn') : '—'}
        />
        <StatTile
          label="دورك الحالي"
          value={isOwner ? 'المالك (OWNER)' : (session?.roleKeys ?? []).join('، ') || '—'}
          intent={isOwner ? 'ok' : 'default'}
        />
      </div>

      {!isOwner ? (
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-2.5 text-xs text-[#8b949e]">
          منح/سحب أدوار العمليات (RBAC) للمالك فقط — الأزرار المقابلة معطّلة لحسابك.
        </p>
      ) : null}

      {/* role × permission matrix (read-only) */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">مصفوفة الأدوار × الصلاحيات (للاطلاع)</h2>
        <div className="overflow-x-auto rounded-lg border border-[#21262d]">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-[#161b22] text-[#8b949e]">
              <tr>
                <th className="sticky right-0 z-10 bg-[#161b22] px-3 py-2 text-right font-medium">
                  الصلاحية
                </th>
                {ROLE_MATRIX.map((r) => (
                  <th key={r.key} className="px-2 py-2 text-center font-medium" title={r.nameAr}>
                    {r.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
              {PERMISSION_KEYS.map((pk) => (
                <tr key={pk}>
                  <td className="sticky right-0 z-10 bg-[#0d1117] px-3 py-1.5 font-mono" dir="ltr">
                    {pk}
                  </td>
                  {ROLE_MATRIX.map((r) => (
                    <td key={r.key} className="px-2 py-1.5 text-center">
                      {roleHas(r.permissions, pk) ? (
                        <span className="text-emerald-400" aria-label="ممنوحة">
                          ✓
                        </span>
                      ) : (
                        <span className="text-[#30363d]" aria-label="غير ممنوحة">
                          ·
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[#484f58]">
          المصدر الأوحد: apps/api/src/ops/permissions.ts (ROLE_MATRIX) — يُطابَق مع قاعدة البيانات عبر
          ops-rbac.spec.ts. علامة ✓ للمالك تعني «*» (يطابق كل الصلاحيات).
        </p>
      </section>

      {/* grant / revoke */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">منح وسحب الأدوار</h2>
        {usersRefused ? (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            تفتقد صلاحية users.lifecycle لعرض دليل المستخدمين.
          </p>
        ) : (
          <TeamManager users={users} canGrantOps={canGrantOps} canGrantProduct={canGrantProduct} />
        )}
      </section>
    </div>
  );
}
