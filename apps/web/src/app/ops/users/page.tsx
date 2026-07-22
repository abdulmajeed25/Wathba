import Link from 'next/link';

import { StatTile } from '../_components/stat-tile';
import { FilterForm, qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { KycQueueTable } from './kyc-queue-table';
import { UsersTable, type UserRow } from './users-table';

/**
 * OPS Phase 2 + OPS-360 Unit 3 — «المستخدمون»: the masked account directory,
 * now with (1) cross-page census tiles drawn from GET /v1/ops/users/stats
 * (statusCounts + verification totals — no longer page-local), and (2) a
 * dedicated KYC / Nafath escalation queue tab (GET /v1/ops/users/kyc-queue)
 * carrying the users.kyc.force-verify + suppliers.verify OpRunners inline.
 *
 * Server-first: the list is fetched with the session's x-ops-token and every
 * email is already maskEmail()'d by the API — the raw value NEVER reaches this
 * surface. The only way to see a real address is the governed, audited
 * users.pii.unmask op on the per-user page. Permission: users.lifecycle (the
 * API refuses otherwise → amber banner).
 */

interface UserStats {
  statusCounts: { active: number; suspended: number; banned: number };
  nafathVerified: number;
  supplierVerified: number;
  total: number;
}

export default async function OpsUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const isKyc = sp.view === 'kyc';
  const supplierMode = sp.supplierUnverified === '1';
  const filters = { role: sp.role, status: sp.status, q: sp.q };
  const headers = { 'x-ops-token': opsToken };

  let rows: UserRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;
  let stats: UserStats | null = null;

  try {
    const listUrl = isKyc
      ? `${API_BASE}/v1/ops/users/kyc-queue${qs({
          supplierUnverified: supplierMode ? '1' : undefined,
          cursor: sp.cursor,
          limit: '50',
        })}`
      : `${API_BASE}/v1/ops/users${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`;

    const [listRes, statsRes] = await Promise.all([
      fetch(listUrl, { headers, cache: 'no-store' }),
      fetch(`${API_BASE}/v1/ops/users/stats`, { headers, cache: 'no-store' }),
    ]);

    if (listRes.status === 403) refused = true;
    if (listRes.ok) {
      const body = (await listRes.json()) as { items: UserRow[]; nextCursor: string | null };
      rows = body.items;
      nextCursor = body.nextCursor;
    }
    if (statsRes.ok) stats = (await statsRes.json()) as UserStats;
  } catch {
    /* API unreachable — the page renders the refused/empty states below */
  }

  const nf = (n: number) => n.toLocaleString('ar-SA');
  const tabBase =
    'rounded-md border px-3 py-1.5 text-sm transition-colors';
  const activeTab = 'border-[#30363d] bg-[#21262d] text-[#e6edf3]';
  const idleTab = 'border-transparent text-[#8b949e] hover:bg-[#161b22]';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">المستخدمون</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            دليل الحسابات — كل بريد وهاتف مقنّع افتراضياً. الكشف عملية محكومة ومدوَّنة في التدقيق،
            وتتمّ من صفحة المستخدم فقط.
          </p>
        </div>
        <Link href="/ops" className="text-sm text-[#58a6ff] hover:underline">
          ← العودة للمركز
        </Link>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية users.lifecycle — اطلبها من المالك لعرض دليل المستخدمين.
        </p>
      ) : null}

      {/* cross-page census tiles (users/stats) — not page-local */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="نشط"
          value={stats ? nf(stats.statusCounts.active) : '—'}
          intent="ok"
          href="/ops/users?status=active"
        />
        <StatTile
          label="موقوف"
          value={stats ? nf(stats.statusCounts.suspended) : '—'}
          intent={stats && stats.statusCounts.suspended > 0 ? 'warn' : 'default'}
          href="/ops/users?status=suspended"
        />
        <StatTile
          label="محظور"
          value={stats ? nf(stats.statusCounts.banned) : '—'}
          intent={stats && stats.statusCounts.banned > 0 ? 'danger' : 'default'}
          href="/ops/users?status=banned"
        />
        <StatTile
          label="موثّق نفاذ"
          value={stats ? nf(stats.nafathVerified) : '—'}
          hint={stats ? `من ${nf(stats.total)} حساب` : undefined}
        />
        <StatTile
          label="موردون موثّقون"
          value={stats ? nf(stats.supplierVerified) : '—'}
          href="/ops/users?view=kyc&supplierUnverified=1"
        />
      </div>

      {/* directory ↔ KYC queue tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#21262d] pb-2">
        <Link href="/ops/users" className={`${tabBase} ${isKyc ? idleTab : activeTab}`}>
          دليل الحسابات
        </Link>
        <Link href="/ops/users?view=kyc" className={`${tabBase} ${isKyc ? activeTab : idleTab}`}>
          طابور التوثيق (KYC)
        </Link>
      </div>

      {isKyc ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/ops/users?view=kyc"
              className={`${tabBase} ${supplierMode ? idleTab : activeTab}`}
            >
              غير موثّقين عبر نفاذ
            </Link>
            <Link
              href="/ops/users?view=kyc&supplierUnverified=1"
              className={`${tabBase} ${supplierMode ? activeTab : idleTab}`}
            >
              موردون بانتظار التوثيق
            </Link>
          </div>
          <p className="text-[11px] text-[#484f58]">
            قائمة تصعيد التوثيق — لكل صف عمليتا الرفع الموثّقتان (فرض توثيق نفاذ / توثيق مورّد) في
            مكانها. ينفَّذ عبر dry-run→معاينة→تنفيذ مُدقَّق، ويسقط الصف من الطابور بعد نجاح العملية.
          </p>
          {refused ? null : (
            <KycQueueTable
              rows={rows}
              supplierMode={supplierMode}
              emptyAr={
                supplierMode
                  ? 'لا موردين بانتظار التوثيق'
                  : 'لا حسابات غير موثّقة عبر نفاذ — الطابور نظيف'
              }
            />
          )}
        </section>
      ) : (
        <>
          <FilterForm
            fields={[
              {
                kind: 'select',
                name: 'role',
                labelAr: 'الدور',
                allLabelAr: 'كل الأدوار',
                options: [
                  { value: 'CREATOR', labelAr: 'صاحب مشروع' },
                  { value: 'BACKER', labelAr: 'داعم' },
                  { value: 'SUPPLIER', labelAr: 'مورّد' },
                  { value: 'ADMIN', labelAr: 'مشرف' },
                ],
              },
              {
                kind: 'select',
                name: 'status',
                labelAr: 'الحالة',
                allLabelAr: 'كل الحالات',
                options: [
                  { value: 'active', labelAr: 'نشط' },
                  { value: 'suspended', labelAr: 'موقوف' },
                  { value: 'banned', labelAr: 'محظور' },
                ],
              },
              { kind: 'text', name: 'q', placeholderAr: 'اسم/بريد/معرّف' },
            ]}
            values={sp}
          />

          <UsersTable
            rows={rows}
            emptyAr={refused ? 'لا صلاحية للعرض' : 'لا مستخدمين مطابقين للمرشحات'}
          />
        </>
      )}

      {nextCursor ? (
        <div className="text-center">
          <Link
            href={
              isKyc
                ? `/ops/users${qs({
                    view: 'kyc',
                    supplierUnverified: supplierMode ? '1' : undefined,
                    cursor: nextCursor,
                  })}`
                : `/ops/users${qs({ ...filters, cursor: nextCursor })}`
            }
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            التالي ↓
          </Link>
        </div>
      ) : null}
    </div>
  );
}
