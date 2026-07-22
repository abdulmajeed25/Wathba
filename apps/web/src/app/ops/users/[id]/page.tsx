import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActorName } from '../../_components/actor-name';
import { RiskTierBadge, StatusBadge, type StatusIntent } from '../../_components/badge';
import { API_BASE, requireAdmin, requireOpsSession } from '../../_lib/guard';
import { formatSar } from '../../_lib/money';
import { UserOperations } from './user-operations';

/**
 * OPS Phase 2 + OPS-360 Unit 3 — the per-user page: masked overview +
 * verification flags + suspension block + the immutable audit timeline + the
 * governed operations panel. Unit 3 replaces the bare pledge/session COUNTS
 * with real masked lists drawn from GET /v1/ops/users/:id/pledges (money via
 * formatSar) and GET /v1/ops/users/:id/sessions (device/session list, hashes
 * withheld), and resolves every actor id via <ActorName>.
 *
 * Server-first; PII stays masked here too — the only reveal is users.pii.unmask
 * (an OpRunner in <UserOperations>). Permission: users.lifecycle → amber banner
 * otherwise.
 */

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  handle: string | null;
  city: string | null;
  roles: string[];
  reputationTier: string | null;
  emailVerified: boolean;
  nafathVerified: boolean;
  nafathVerifiedAt: string | null;
  supplierVerifiedAt: string | null;
  totalPledgedHalalas: string | null;
  suspension: {
    suspendedAt: string | null;
    suspendedKind: 'SUSPENDED' | 'BANNED' | null;
    suspendedReasonAr: string | null;
  };
  activeSessionCount: number;
  pledgeCount: number;
  projectCount: number;
  createdAt: string;
}

interface AuditRow {
  id: string;
  chainSeq: string;
  actorType: string;
  actorId: string | null;
  action: string;
  riskTier: string | null;
  reason: string | null;
  createdAt: string;
}

interface PledgeRow {
  id: string;
  projectId: string;
  amountHalalas: string | null;
  addOnsHalalas: string | null;
  status: string;
  paymentMethod: string | null;
  contractType: string | null;
  createdAt: string | null;
}

interface SessionRow {
  kind: 'token' | 'device';
  id: string;
  active: boolean;
  createdAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
  deviceHashMasked: string | null;
}

const PLEDGE_STATUS_INTENT: Record<string, StatusIntent> = {
  CAPTURED: 'ok',
  AUTHORIZED: 'info',
  COLLECTED: 'ok',
  PENDING: 'warn',
  DISPUTED: 'danger',
  REFUNDED: 'muted',
  FAILED: 'danger',
  CANCELLED: 'muted',
};

const ROLE_AR: Record<string, string> = {
  ADMIN: 'مشرف',
  CREATOR: 'صاحب مشروع',
  BACKER: 'داعم',
  SUPPLIER: 'مورّد',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-[#21262d] bg-[#0d1117] px-3 py-2">
      <dt className="text-[11px] text-[#8b949e]">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function OpsUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const { id } = await params;

  let user: UserDetail | null = null;
  let audit: AuditRow[] = [];
  let pledges: PledgeRow[] = [];
  let sessions: SessionRow[] = [];
  let refused = false;
  let missing = false;

  const headers = { 'x-ops-token': opsToken };

  try {
    const [uRes, aRes, pRes, sRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/users/${id}`, { headers, cache: 'no-store' }),
      fetch(`${API_BASE}/v1/ops/audit/entity/User/${id}?limit=100`, { headers, cache: 'no-store' }),
      fetch(`${API_BASE}/v1/ops/users/${id}/pledges?limit=25`, { headers, cache: 'no-store' }),
      fetch(`${API_BASE}/v1/ops/users/${id}/sessions?limit=25`, { headers, cache: 'no-store' }),
    ]);
    if (uRes.status === 403) refused = true;
    if (uRes.status === 404) missing = true;
    if (uRes.ok) user = (await uRes.json()) as UserDetail;
    if (aRes.ok) audit = ((await aRes.json()) as { items: AuditRow[] }).items;
    if (pRes.ok) pledges = ((await pRes.json()) as { items: PledgeRow[] }).items;
    if (sRes.ok) sessions = ((await sRes.json()) as { items: SessionRow[] }).items;
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  if (missing) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{user?.name ?? 'مستخدم'}</h1>
          <p className="mt-1 font-mono text-xs text-[#8b949e]" dir="ltr">
            {id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/ops/notifications?userId=${id}`}
            className="text-sm text-[#58a6ff] hover:underline"
          >
            الإشعارات ←
          </Link>
          <Link href="/ops/users" className="text-sm text-[#58a6ff] hover:underline">
            ← دليل المستخدمين
          </Link>
        </div>
      </div>

      {refused ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية users.lifecycle — اطلبها من المالك لعرض هذا الحساب.
        </p>
      ) : null}

      {user ? (
        <>
          {user.suspension.suspendedAt ? (
            <div
              className={`rounded border px-4 py-3 text-sm ${
                user.suspension.suspendedKind === 'BANNED'
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}
            >
              <strong>
                {user.suspension.suspendedKind === 'BANNED' ? 'حساب محظور نهائياً' : 'حساب موقوف'}
              </strong>
              {' — '}
              {new Date(user.suspension.suspendedAt).toLocaleString('ar-SA')}
              {user.suspension.suspendedReasonAr ? (
                <span className="block text-xs opacity-90">
                  السبب: {user.suspension.suspendedReasonAr}
                </span>
              ) : null}
            </div>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#8b949e]">الملف (مقنّع)</h2>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="البريد (مقنّع)">
                <span dir="ltr" className="font-mono text-xs">
                  {user.email}
                </span>
              </Field>
              <Field label="الهاتف (مقنّع)">
                <span dir="ltr" className="font-mono text-xs">
                  {user.phone || '—'}
                </span>
              </Field>
              <Field label="المعرّف العام">{user.handle ? `@${user.handle}` : '—'}</Field>
              <Field label="المدينة">{user.city || '—'}</Field>
              <Field label="مستوى السمعة">{user.reputationTier || '—'}</Field>
              <Field label="الانضمام">
                {new Date(user.createdAt).toLocaleString('ar-SA', { dateStyle: 'medium' })}
              </Field>
              <Field label="الأدوار">
                <span className="flex flex-wrap gap-1">
                  {user.roles.length ? (
                    user.roles.map((r) => (
                      <StatusBadge key={r} intent={r === 'ADMIN' ? 'info' : 'muted'}>
                        {ROLE_AR[r] ?? r}
                      </StatusBadge>
                    ))
                  ) : (
                    <span className="text-[#484f58]">—</span>
                  )}
                </span>
              </Field>
              <Field label="التوثيق">
                <span className="flex flex-wrap gap-1">
                  <StatusBadge intent={user.emailVerified ? 'ok' : 'muted'}>
                    البريد {user.emailVerified ? '✓' : '—'}
                  </StatusBadge>
                  <StatusBadge intent={user.nafathVerified ? 'ok' : 'muted'}>
                    نفاذ {user.nafathVerified ? '✓' : '—'}
                  </StatusBadge>
                  <StatusBadge intent={user.supplierVerifiedAt ? 'ok' : 'muted'}>
                    مورّد {user.supplierVerifiedAt ? '✓' : '—'}
                  </StatusBadge>
                </span>
              </Field>
              <Field label="إجمالي التعهّد">
                <span className="tabular-nums">{formatSar(user.totalPledgedHalalas)}</span>
              </Field>
            </dl>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
              <p className="text-xs text-[#8b949e]">جلسات نشطة</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{user.activeSessionCount}</p>
            </div>
            <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
              <p className="text-xs text-[#8b949e]">التعهّدات</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{user.pledgeCount}</p>
            </div>
            <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
              <p className="text-xs text-[#8b949e]">المشاريع المُنشأة</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{user.projectCount}</p>
            </div>
          </section>

          {/* pledges — real masked list (replaces the bare count) */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#8b949e]">
              تعهّدات هذا الحساب{' '}
              <span className="text-[11px] font-normal text-[#484f58]">
                (أحدث {Math.min(pledges.length, 25).toLocaleString('ar-SA')} من{' '}
                {user.pledgeCount.toLocaleString('ar-SA')})
              </span>
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[#21262d]">
              {pledges.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[#8b949e]">لا تعهّدات لهذا الحساب.</p>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-[#161b22] text-right text-[#8b949e]">
                    <tr>
                      <th className="px-3 py-2 font-medium">المشروع</th>
                      <th className="px-3 py-2 text-left font-medium">المبلغ</th>
                      <th className="px-3 py-2 text-left font-medium">الإضافات</th>
                      <th className="px-3 py-2 font-medium">الحالة</th>
                      <th className="px-3 py-2 font-medium">العقد</th>
                      <th className="px-3 py-2 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
                    {pledges.map((p) => (
                      <tr key={p.id} className="align-top">
                        <td className="px-3 py-2">
                          <Link
                            href={`/ops/projects/${p.projectId}`}
                            dir="ltr"
                            className="font-mono text-xs text-[#58a6ff] hover:underline"
                          >
                            {p.projectId.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-left tabular-nums">
                          {formatSar(p.amountHalalas)}
                        </td>
                        <td className="px-3 py-2 text-left tabular-nums text-[#8b949e]">
                          {formatSar(p.addOnsHalalas)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge intent={PLEDGE_STATUS_INTENT[p.status] ?? 'muted'}>
                            {p.status}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#8b949e]">{p.contractType ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-[#8b949e]">
                          {p.createdAt
                            ? new Date(p.createdAt).toLocaleDateString('ar-SA', {
                                dateStyle: 'medium',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* sessions — device/session list (hashes withheld by the API) */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#8b949e]">
              الجلسات والأجهزة{' '}
              <span className="text-[11px] font-normal text-[#484f58]">
                (أحدث {Math.min(sessions.length, 25).toLocaleString('ar-SA')} — البصمات محجوبة)
              </span>
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[#21262d]">
              {sessions.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[#8b949e]">
                  لا جلسات أو أجهزة مسجّلة.
                </p>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-[#161b22] text-right text-[#8b949e]">
                    <tr>
                      <th className="px-3 py-2 font-medium">النوع</th>
                      <th className="px-3 py-2 font-medium">الحالة</th>
                      <th className="px-3 py-2 font-medium">بصمة الجهاز</th>
                      <th className="px-3 py-2 font-medium">آخر ظهور</th>
                      <th className="px-3 py-2 font-medium">أُنشئت</th>
                      <th className="px-3 py-2 font-medium">تنتهي/أُلغيت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
                    {sessions.map((s) => (
                      <tr key={`${s.kind}-${s.id}`} className="align-top">
                        <td className="px-3 py-2">
                          <StatusBadge intent={s.kind === 'token' ? 'info' : 'muted'}>
                            {s.kind === 'token' ? 'جلسة' : 'جهاز'}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2">
                          {s.active ? (
                            <StatusBadge intent="ok">نشطة</StatusBadge>
                          ) : s.revokedAt ? (
                            <StatusBadge intent="danger">مُلغاة</StatusBadge>
                          ) : (
                            <StatusBadge intent="muted">منتهية</StatusBadge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[#8b949e]" dir="ltr">
                          {s.deviceHashMasked ?? '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-[#8b949e]">
                          {s.lastSeenAt
                            ? new Date(s.lastSeenAt).toLocaleString('ar-SA', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-[#8b949e]">
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleString('ar-SA', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-[#8b949e]">
                          {s.revokedAt
                            ? new Date(s.revokedAt).toLocaleString('ar-SA', { dateStyle: 'short' })
                            : s.expiresAt
                              ? new Date(s.expiresAt).toLocaleString('ar-SA', { dateStyle: 'short' })
                              : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#8b949e]">العمليات</h2>
            <UserOperations
              userId={user.id}
              userName={user.name}
              suspendedKind={user.suspension.suspendedKind}
              suspended={!!user.suspension.suspendedAt}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#8b949e]">سجل التدقيق لهذا الحساب</h2>
            <div className="overflow-hidden rounded-lg border border-[#21262d]">
              {audit.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[#8b949e]">
                  لا قيود تدقيق مرتبطة بهذا الحساب بعد
                </p>
              ) : (
                <ol className="divide-y divide-[#21262d]">
                  {audit.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 bg-[#0d1117] px-4 py-2.5">
                      <span className="mt-0.5 tabular-nums text-[11px] text-[#484f58]">
                        {r.chainSeq}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="font-mono text-xs text-[#e6edf3]">{r.action}</code>
                          <RiskTierBadge tier={r.riskTier} />
                          <span className="text-[11px] text-[#8b949e]">
                            {r.actorType}
                            {r.actorId ? (
                              <>
                                {' · '}
                                <ActorName id={r.actorId} className="text-[11px] text-[#8b949e]" />
                              </>
                            ) : null}
                          </span>
                        </div>
                        {r.reason ? (
                          <p className="mt-0.5 text-xs text-[#8b949e]">{r.reason}</p>
                        ) : null}
                      </div>
                      <time className="whitespace-nowrap text-[11px] text-[#8b949e]">
                        {new Date(r.createdAt).toLocaleString('ar-SA', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </>
      ) : !refused ? (
        <p className="rounded border border-[#21262d] bg-[#161b22] px-4 py-6 text-center text-sm text-[#8b949e]">
          تعذّر تحميل الحساب.
        </p>
      ) : null}
    </div>
  );
}
