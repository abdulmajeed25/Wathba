import Link from 'next/link';

import { FilterForm, qs } from '../_lib/filters';
import { API_BASE, requireAdmin, requireOpsSession } from '../_lib/guard';
import { UsersTable, type UserRow } from './users-table';

/**
 * OPS Phase 2 — «المستخدمون»: the masked account directory. Server-first: the
 * list is fetched with the session's x-ops-token and every email is already
 * maskEmail()'d by the API — the raw value NEVER reaches this surface. The
 * only way to see a real address is the governed, audited users.pii.unmask op
 * on the per-user page. Filters are a plain GET form; pagination is a cursor
 * link. Permission: users.lifecycle (the API refuses otherwise → amber banner).
 */

export default async function OpsUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const sp = await searchParams;

  const filters = { role: sp.role, status: sp.status, q: sp.q };

  let rows: UserRow[] = [];
  let nextCursor: string | null = null;
  let refused = false;

  try {
    const res = await fetch(
      `${API_BASE}/v1/ops/users${qs({ ...filters, cursor: sp.cursor, limit: '50' })}`,
      { headers: { 'x-ops-token': opsToken }, cache: 'no-store' },
    );
    if (res.status === 403) refused = true;
    if (res.ok) {
      const body = (await res.json()) as { items: UserRow[]; nextCursor: string | null };
      rows = body.items;
      nextCursor = body.nextCursor;
    }
  } catch {
    /* API unreachable — the page renders the refused/empty states below */
  }

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

      <UsersTable rows={rows} emptyAr={refused ? 'لا صلاحية للعرض' : 'لا مستخدمين مطابقين للمرشحات'} />

      {nextCursor ? (
        <div className="text-center">
          <Link
            href={`/ops/users${qs({ ...filters, cursor: nextCursor })}`}
            className="inline-block rounded border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm hover:bg-[#21262d]"
          >
            التالي ↓
          </Link>
        </div>
      ) : null}
    </div>
  );
}
