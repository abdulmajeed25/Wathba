import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActorName } from '../../_components/actor-name';
import { API_BASE, requireAdmin, requireOpsSession } from '../../_lib/guard';
import { StatusBadge, type StatusIntent } from '../../_components/badge';
import { TicketActions } from '../ticket-actions';

/**
 * OPS Phase 2 — ticket detail. Overview + the original message + internal
 * notes timeline + the per-entity audit timeline + the governed operations
 * panel (assign / status / note / reply). Email is masked by the API.
 */

interface Note {
  id: string;
  authorId: string;
  noteAr: string;
  createdAt: string | null;
}
interface TicketDetail {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  topic: string;
  messageAr: string;
  status: string;
  assignedToId: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  notes: Note[];
}
interface AuditRow {
  id: string;
  chainSeq: string;
  action: string;
  actorType: string;
  reason: string | null;
  createdAt: string;
}

const STATUS_INTENT: Record<string, StatusIntent> = {
  OPEN: 'warn',
  IN_PROGRESS: 'info',
  RESOLVED: 'ok',
  CLOSED: 'muted',
};
const STATUS_AR: Record<string, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد المعالجة',
  RESOLVED: 'محلولة',
  CLOSED: 'مغلقة',
};

export default async function OpsTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { opsToken } = await requireOpsSession();
  const { id } = await params;

  let ticket: TicketDetail | null = null;
  let refused = false;
  let audit: AuditRow[] = [];

  try {
    const [tRes, auditRes] = await Promise.all([
      fetch(`${API_BASE}/v1/ops/tickets/${id}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/v1/ops/audit/entity/SupportTicket/${id}`, {
        headers: { 'x-ops-token': opsToken },
        cache: 'no-store',
      }),
    ]);
    if (tRes.status === 403) refused = true;
    if (tRes.status === 404) notFound();
    if (tRes.ok) ticket = (await tRes.json()) as TicketDetail;
    if (auditRes.ok) audit = ((await auditRes.json()) as { items: AuditRow[] }).items;
  } catch {
    /* API unreachable — refused/empty states render below */
  }

  if (refused) {
    return (
      <div className="space-y-4">
        <Link href="/ops/support" className="text-sm text-[#58a6ff] hover:underline">
          ← الدعم
        </Link>
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          تفتقد صلاحية support.tickets لعرض التذكرة.
        </p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Link href="/ops/support" className="text-sm text-[#58a6ff] hover:underline">
          ← الدعم
        </Link>
        <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm text-[#8b949e]">
          تعذّر تحميل التذكرة (الخادم غير متاح أو التذكرة غير موجودة).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/ops/support" className="text-sm text-[#58a6ff] hover:underline">
            ← الدعم
          </Link>
          <h1 className="mt-1 text-lg font-bold">{ticket.topic}</h1>
        </div>
        <StatusBadge intent={STATUS_INTENT[ticket.status] ?? 'muted'}>
          {STATUS_AR[ticket.status] ?? ticket.status}
        </StatusBadge>
      </div>

      {/* overview */}
      <dl className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-[#8b949e]">صاحب التذكرة</dt>
          <dd className="mt-0.5">{ticket.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#8b949e]">البريد (مقنَّع)</dt>
          <dd className="mt-0.5" dir="ltr">
            {ticket.email}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#8b949e]">المُسنَد إليه</dt>
          <dd className="mt-0.5 text-sm">
            {ticket.assignedToId ? (
              <ActorName id={ticket.assignedToId} className="text-sm text-[#e6edf3]" />
            ) : (
              <span className="text-[#484f58]">غير مُسنَدة</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#8b949e]">وردت في</dt>
          <dd className="mt-0.5 text-sm">
            {ticket.createdAt
              ? new Date(ticket.createdAt).toLocaleString('ar-SA', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : '—'}
          </dd>
        </div>
      </dl>

      {/* original message */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">الرسالة</h2>
        <p className="whitespace-pre-wrap rounded-lg border border-[#21262d] bg-[#0d1117] p-4 text-sm">
          {ticket.messageAr}
        </p>
      </section>

      {/* operations */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">العمليات</h2>
        <TicketActions ticketId={ticket.id} status={ticket.status} />
      </section>

      {/* internal notes */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">الملاحظات الداخلية</h2>
        <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
          {ticket.notes.length === 0 ? (
            <p className="text-sm text-[#8b949e]">لا ملاحظات داخلية بعد.</p>
          ) : (
            <ol className="space-y-3">
              {ticket.notes.map((n) => (
                <li key={n.id} className="border-r-2 border-[#30363d] pr-3">
                  <p className="whitespace-pre-wrap text-sm">{n.noteAr}</p>
                  <p className="mt-1 text-[11px] text-[#8b949e]">
                    <ActorName id={n.authorId} className="text-[11px] text-[#8b949e]" /> ·{' '}
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleString('ar-SA', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* audit timeline */}
      <section className="space-y-2">
        <h2 className="text-base font-bold">سجل التذكرة</h2>
        <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
          {audit.length === 0 ? (
            <p className="text-sm text-[#8b949e]">لا قيود تدقيق مرتبطة مباشرةً بهذه التذكرة.</p>
          ) : (
            <ol className="space-y-2">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="tabular-nums text-[#484f58]">#{a.chainSeq}</span>
                  <span className="whitespace-nowrap text-[#8b949e]">
                    {new Date(a.createdAt).toLocaleString('ar-SA', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <code className="font-mono text-[#e6edf3]">{a.action}</code>
                  <span className="text-[#8b949e]">{a.actorType}</span>
                  {a.reason ? <span className="text-[#8b949e]">— {a.reason}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
