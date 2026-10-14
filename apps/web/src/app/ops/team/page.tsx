import Link from 'next/link';

import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { RetryRead } from '../_components/retry-read';
import { StatTile } from '../_components/stat-tile';
import { TeamManager, type DirUser } from './team-manager';

interface RoleCatalogue {
  roles: Array<{ key: string; nameAr: string; permissions: string[] }>;
  permissions: string[];
}
function roleHas(perms: readonly string[], key: string): boolean {
  return perms.includes('*') || perms.includes(key);
}

export default async function OpsTeamPage() {
  await requireAdmin();
  const { opsToken, info: session } = await requireOpsSession();
  const read = async (path: string) => {
    try {
      const response = await fetch(`${API_BASE}/v1/ops/${path}`, {
        headers: { 'x-ops-token': opsToken }, cache: 'no-store',
      });
      return { status: response.status, data: response.ok ? await response.json() : null };
    } catch { return { status: 0, data: null }; }
  };
  const [usersResult, catalogueResult] = await Promise.all([read('users?limit=100'), read('auth/roles')]);
  const users: DirUser[] | null = Array.isArray(usersResult.data?.items) ? usersResult.data.items : null;
  const usersRefused = usersResult.status === 403;
  const catalogue: RoleCatalogue | null = Array.isArray(catalogueResult.data?.roles) &&
    Array.isArray(catalogueResult.data?.permissions) ? catalogueResult.data : null;
  const perms = session.permissions ?? [];
  const isOwner = (session.roleKeys ?? []).includes('OWNER');
  const canGrantOps = isOwner && roleHas(perms, 'users.roles.assign') && catalogue !== null;
  const canGrantProduct = roleHas(perms, 'users.lifecycle');

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
        {catalogue ? <div className="overflow-x-auto rounded-lg border border-[#21262d]">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-[#161b22] text-[#8b949e]">
              <tr>
                <th className="sticky right-0 z-10 bg-[#161b22] px-3 py-2 text-right font-medium">
                  الصلاحية
                </th>
                {catalogue.roles.map((r) => (
                  <th key={r.key} className="px-2 py-2 text-center font-medium" title={r.nameAr}>
                    {r.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
              {catalogue.permissions.map((pk) => (
                <tr key={pk}>
                  <td className="sticky right-0 z-10 bg-[#0d1117] px-3 py-1.5 font-mono" dir="ltr">
                    {pk}
                  </td>
                  {catalogue.roles.map((r) => (
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
        : <div role="alert" className="rounded border border-amber-500/40 p-4 text-sm">
          تعذر تحميل الأدوار الفعلية؛ لا نعرض مصفوفة بديلة أو نسمح بمنح دور غير مؤكد.
          <RetryRead label="إعادة تحميل الأدوار" />
        </div>}
        <p className="text-xs text-[#8b949e]">تعرض المصفوفة الصلاحيات المسجلة حاليًا، وتخضع كل عملية لشروطها الإضافية. منح أدوار الإدارة وسحبها يتطلبان عضوية المالك الفعلية، حتى لمن لديه صلاحية تعيين الأدوار. المنح والسحب يمران بالمراجعة والتوثيق.</p>
      </section>

      {/* grant / revoke */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">منح وسحب الأدوار</h2>
        {usersRefused ? (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            تفتقد صلاحية users.lifecycle لعرض دليل المستخدمين.
          </p>
        ) : users === null ? (
          <div role="alert" className="rounded border border-amber-500/40 p-4 text-sm">
            تعذرت قراءة المستخدمين؛ لا يمكن تأكيد أعضاء الفريق الحاليين.
            <RetryRead label="إعادة تحميل الفريق" />
          </div>
        ) : (
          <TeamManager users={users} canGrantOps={canGrantOps} canGrantProduct={canGrantProduct} opsRoles={catalogue?.roles ?? []} />
        )}
      </section>
    </div>
  );
}
