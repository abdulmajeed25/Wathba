import Link from 'next/link';

import { ActorName } from '../../_components/actor-name';
import { StatusBadge } from '../../_components/badge';
import { OpRunner } from '../../_components/op-runner';
import { API_BASE, requireAdmin, requireOpsSession } from '../../_lib/guard';
import { appealStatusIntent, appealStatusLabel } from '../status';

/**
 * OPS-GAPS R1 — the per-appeal WORKSPACE. Server-first.
 *
 * Reads GET /v1/ops/appeals/:id — the appeal itself, the ORIGINAL-decision
 * context it contests (a suspension block for a ban, or the project's
 * reviewFeedback for a rejection, plus the ban/reject AuditLog entry), and the
 * `originalDeciderId`. Then the immutable audit trail of the subject entity
 * (User for a ban, Project for a rejection).
 *
 * The decide panel is governed OpRunners:
 *   • SUBMITTED     → appeals.claim  (SENSITIVE) — take it under review.
 *   • UNDER_REVIEW  → appeals.decide ×3 (UPHELD / OVERTURNED /
 *                     PARTIALLY_GRANTED, each requiresReason, SENSITIVE).
 *
 * FOUR-EYES: if `originalDeciderId` is the current operator, every decide
 * button is disabled with an inline «لا يمكنك مراجعة قرارك» — another operator
 * must rule. Degrades to an amber «قيد الإنشاء» note when the endpoint 404s.
 */

interface AuditEntry {
  id: string;
  chainSeq: string;
  actorType: string;
  actorId: string | null;
  action: string;
  riskTier: string | null;
  reason: string | null;
  createdAt: string;
}

interface AppealDetail {
  id: string;
  kind: 'ACCOUNT_BAN' | 'PROJECT_REJECTION' | string;
  kindAr: string;
  subjectId: string;
  status: string;
  reasonAr: string | null;
  submitter: string;
  createdAt: string;
  decidedAt: string | null;
  outcome: string | null;
  decisionReason: string | null;
  originalDeciderId: string | null;
  /** Ban context — the suspension block. */
  suspension?: {
    reasonAr?: string | null;
    bannedAt?: string | null;
    expiresAt?: string | null;
    permanent?: boolean;
  } | null;
  /** Rejection context — the project's review feedback. */
  reviewFeedback?: string | null;
  projectTitleAr?: string | null;
  /** The ban/reject AuditLog entry that this appeal contests. */
  originalDecision?: AuditEntry | null;
}

/** Session shape — read only for the operator id (four-eyes comparison). */
interface OpsSessionId {
  id?: string;
  operatorId?: string;
  operatorUserId?: string;
  userId?: string;
  sub?: string;
}

function fmtDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

async function fetchOperatorId(opsToken: string): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/v1/ops/auth/session`, {
      headers: { 'x-ops-token': opsToken },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const s = (await r.json()) as OpsSessionId;
    return s.operatorUserId ?? s.operatorId ?? s.userId ?? s.id ?? s.sub ?? null;
  } catch {
    return null;
  }
}

export default async function OpsAppealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const { id } = await params;

  const opts = { headers: { 'x-ops-token': opsToken }, cache: 'no-store' as const };

  let detail: AppealDetail | null = null;
  let refused = false;
  let pending = false;
  let trail: AuditEntry[] = [];

  try {
    const dRes = await fetch(`${API_BASE}/v1/ops/appeals/${id}`, opts);
    if (dRes.status === 403) refused = true;
    else if (dRes.status === 404) pending = true; // route absent → still building
    else if (dRes.ok) detail = (await dRes.json()) as AppealDetail;
  } catch {
    /* API unreachable — states render below */
  }

  const operatorId = detail ? await fetchOperatorId(opsToken) : null;

  // The subject entity trail (User for a ban, Project for a rejection).
  if (detail) {
    // CLOSEOUT C4 — the audit deep-link follows the subject's entity type.
    const entity =
      detail.kind === 'PROJECT_REJECTION'
        ? 'Project'
        : detail.kind === 'CONTENT_TAKEDOWN'
          ? 'Comment'
          : 'User';
    try {
      const r = await fetch(
        `${API_BASE}/v1/ops/audit/entity/${entity}/${detail.subjectId}?limit=100`,
        opts,
      );
      if (r.ok) trail = ((await r.json()) as { items: AuditEntry[] }).items ?? [];
    } catch {
      /* trail unreachable — its empty state renders */
    }
  }

  const back = (
    <Link href="/ops/appeals" className="text-sm text-[#58a6ff] hover:underline">
      ← كل التظلّمات
    </Link>
  );

  if (refused) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">التظلّم</h1>
          {back}
        </div>
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية الإشراف (moderation.queue) — اطلبها من المالك.
        </p>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">التظلّم</h1>
          {back}
        </div>
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          خدمة التظلّمات قيد الإنشاء — لم يُفعَّل مسار «GET /v1/ops/appeals/:id» بعد على الخادم.
        </p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">التظلّم</h1>
          {back}
        </div>
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          تعذّر تحميل التظلّم (الخادم غير متاح).
        </p>
      </div>
    );
  }

  const d = detail;
  const isBan = d.kind === 'ACCOUNT_BAN';
  const subjectEntity = isBan ? 'User' : 'Project';
  const conflict = !!operatorId && !!d.originalDeciderId && operatorId === d.originalDeciderId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold">تظلّم — {d.kindAr}</h1>
            <StatusBadge intent={appealStatusIntent(d.status)}>{appealStatusLabel(d.status)}</StatusBadge>
            <StatusBadge intent={isBan ? 'danger' : 'warn'}>{d.kindAr}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-[#8b949e]">
            مُقدِّم التظلّم: {d.submitter} · قُدِّم {fmtDate(d.createdAt)}
            {d.decidedAt ? ` · حُسِم ${fmtDate(d.decidedAt)}` : ''}
          </p>
        </div>
        {back}
      </div>

      {/* The appellant's own reasoning */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">حجّة المتظلّم</h2>
        <p className="rounded border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm">
          {d.reasonAr?.trim() ? d.reasonAr : <span className="text-[#8b949e]">— لم يُرفَق سبب —</span>}
        </p>
      </section>

      {/* The original decision being contested */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">القرار الأصلي المُعترَض عليه</h2>
        {isBan ? (
          <div className="space-y-2 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <p className="font-bold">حظر حساب</p>
            {d.suspension?.reasonAr ? <p>السبب: {d.suspension.reasonAr}</p> : null}
            <p className="text-xs text-red-200/80">
              {d.suspension?.permanent
                ? 'حظر دائم'
                : d.suspension?.expiresAt
                  ? `ينتهي ${fmtDate(d.suspension.expiresAt)}`
                  : 'مدة غير محدَّدة'}
              {d.suspension?.bannedAt ? ` · حُظِر ${fmtDate(d.suspension.bannedAt)}` : ''}
            </p>
            {!d.suspension ? (
              <p className="text-xs text-red-200/80">لم تُرفَق تفاصيل الحظر مع القرار.</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <p className="font-bold">
              رفض مشروع{d.projectTitleAr ? ` — ${d.projectTitleAr}` : ''}
            </p>
            {d.reviewFeedback ? (
              <p>ملاحظات المراجعة: {d.reviewFeedback}</p>
            ) : (
              <p className="text-xs text-amber-200/80">لم تُرفَق ملاحظات مراجعة مع القرار.</p>
            )}
            <Link
              href={`/ops/projects/${d.subjectId}`}
              className="inline-block text-xs text-[#58a6ff] hover:underline"
            >
              فتح المشروع في مركز العمليات ←
            </Link>
          </div>
        )}

        {d.originalDecision ? (
          <div className="rounded border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm">
            <p className="mb-1 text-xs text-[#8b949e]">قيد التدقيق للقرار الأصلي</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="tabular-nums text-[#484f58]">#{d.originalDecision.chainSeq}</span>
              <code className="font-mono text-xs text-[#e6edf3]">{d.originalDecision.action}</code>
              <span className="whitespace-nowrap text-xs text-[#8b949e]">
                {fmtDate(d.originalDecision.createdAt)}
              </span>
              <span className="text-xs text-[#8b949e]">
                القرار الأصلي: <ActorName id={d.originalDeciderId} className="text-xs" />
              </span>
            </div>
            {d.originalDecision.reason ? (
              <p className="mt-1 text-xs text-[#8b949e]">— {d.originalDecision.reason}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-[#8b949e]">
            صاحب القرار الأصلي: <ActorName id={d.originalDeciderId} className="text-xs" />
          </p>
        )}
      </section>

      {/* The decision so far (once decided) */}
      {d.status !== 'SUBMITTED' && d.status !== 'UNDER_REVIEW' ? (
        <section className="space-y-2">
          <h2 className="text-base font-bold">قرار التظلّم</h2>
          <div className="rounded border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm">
            <StatusBadge intent={appealStatusIntent(d.status)}>{appealStatusLabel(d.status)}</StatusBadge>
            {d.decisionReason ? <p className="mt-2 text-[#8b949e]">— {d.decisionReason}</p> : null}
          </div>
        </section>
      ) : null}

      {/* The decide panel */}
      <section className="space-y-4">
        <h2 className="text-base font-bold">القرار</h2>
        <p className="text-xs text-[#8b949e]">
          كل إجراء يمرّ بالمعاينة (dry-run) قبل التنفيذ ويُسجَّل في التدقيق. مبدأ الأربع أعين مُلزِم:
          لا يُراجع القرارَ مُتّخِذُه.
        </p>

        {conflict ? (
          <p className="rounded border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            لا يمكنك مراجعة قرارك — يقرّره مشغّل آخر.
          </p>
        ) : null}

        {d.status === 'SUBMITTED' ? (
          <div className="flex flex-wrap items-center gap-2 rounded border border-[#30363d] bg-[#0d1117] p-3">
            <span className="w-full text-sm font-bold">استلام التظلّم</span>
            <OpRunner
              opKey="appeals.claim"
              input={{ appealId: d.id }}
              triggerLabel="استلام للمراجعة"
              variant="primary"
              requiresReason={false}
              riskTier="SENSITIVE"
              disabled={conflict}
            />
          </div>
        ) : null}

        {d.status === 'UNDER_REVIEW' ? (
          <div className="flex flex-wrap items-center gap-2 rounded border border-[#30363d] bg-[#0d1117] p-3">
            <span className="w-full text-sm font-bold">إصدار القرار</span>
            <OpRunner
              opKey="appeals.decide"
              input={{ appealId: d.id, outcome: 'OVERTURNED' }}
              triggerLabel="قبول التظلّم (إلغاء القرار)"
              variant="primary"
              requiresReason
              riskTier="SENSITIVE"
              disabled={conflict}
            />
            <OpRunner
              opKey="appeals.decide"
              input={{ appealId: d.id, outcome: 'PARTIALLY_GRANTED' }}
              triggerLabel="قبول جزئي"
              variant="ghost"
              requiresReason
              riskTier="SENSITIVE"
              disabled={conflict}
            />
            <OpRunner
              opKey="appeals.decide"
              input={{ appealId: d.id, outcome: 'UPHELD' }}
              triggerLabel="رفض التظلّم (تثبيت القرار)"
              variant="danger"
              requiresReason
              riskTier="SENSITIVE"
              disabled={conflict}
            />
          </div>
        ) : null}

        {d.status !== 'SUBMITTED' && d.status !== 'UNDER_REVIEW' ? (
          <p className="text-xs text-[#484f58]">التظلّم محسوم — لا إجراءات متاحة.</p>
        ) : null}
      </section>

      {/* The subject's immutable audit trail */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">الخط الزمني للتدقيق ({isBan ? 'المستخدم' : 'المشروع'})</h2>
        <p className="text-xs text-[#8b949e]">
          كل عملية محكومة لمست هذا {isBan ? 'الحساب' : 'المشروع'} — من السجل غير القابل للتعديل.{' '}
          <Link
            href={`/ops/audit?entity=${subjectEntity}&entityId=${d.subjectId}`}
            className="text-[#58a6ff] hover:underline"
          >
            فتح في سجل التدقيق ←
          </Link>
        </p>
        {trail.length === 0 ? (
          <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-6 text-center text-sm text-[#8b949e]">
            لا قيود تدقيق بعد
          </p>
        ) : (
          <ol className="space-y-2">
            {trail.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm"
              >
                <span className="tabular-nums text-[#484f58]">#{r.chainSeq}</span>
                <span className="whitespace-nowrap text-xs text-[#8b949e]">{fmtDate(r.createdAt)}</span>
                <code className="font-mono text-xs text-[#e6edf3]">{r.action}</code>
                {r.riskTier ? <StatusBadge intent="muted">{r.riskTier}</StatusBadge> : null}
                <span className="text-xs text-[#8b949e]">
                  <ActorName id={r.actorId} className="text-xs" fallback={r.actorType} />
                </span>
                {r.reason ? <span className="basis-full text-xs text-[#8b949e]">— {r.reason}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
