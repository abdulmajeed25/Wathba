'use client';

import { useState } from 'react';

import { OpRunner } from '../_components/op-runner';

/**
 * OPS Phase 2 — the ticket operations panel. Each governed action needs a
 * free-text/select input the plain <OpRunner> can't collect on its own, so
 * this island captures the value in local state and feeds it as the runner's
 * `input`. The runner still owns dry-run → preview → execute; a successful
 * run reloads the server component to reflect the new state.
 */

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const STATUS_AR: Record<string, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد المعالجة',
  RESOLVED: 'محلولة',
  CLOSED: 'مغلقة',
};

const INPUT =
  'w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm outline-none focus:border-emerald-500';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function TicketActions({ ticketId, status }: { ticketId: string; status: string }) {
  const [assigneeId, setAssigneeId] = useState('');
  const [nextStatus, setNextStatus] = useState(status);
  const [noteAr, setNoteAr] = useState('');
  const [replyAr, setReplyAr] = useState('');

  const reload = () => window.location.reload();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* assign */}
      <div className="space-y-2 rounded-lg border border-[#21262d] bg-[#161b22] p-4">
        <h3 className="text-sm font-bold">الإسناد</h3>
        <input
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          placeholder="مُعرّف المشغّل (UUID)"
          className={INPUT}
          dir="ltr"
        />
        <OpRunner
          opKey="support.ticket.assign"
          input={{ ticketId, assigneeId }}
          triggerLabel="إسناد التذكرة"
          riskTier="STANDARD"
          requiresReason={false}
          variant="ghost"
          disabled={!UUID_RE.test(assigneeId)}
          onDone={reload}
        />
      </div>

      {/* status */}
      <div className="space-y-2 rounded-lg border border-[#21262d] bg-[#161b22] p-4">
        <h3 className="text-sm font-bold">تغيير الحالة</h3>
        <select
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
          className={INPUT}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_AR[s]}
            </option>
          ))}
        </select>
        <OpRunner
          opKey="support.ticket.status.set"
          input={{ ticketId, status: nextStatus }}
          triggerLabel="تحديث الحالة"
          riskTier="STANDARD"
          requiresReason={false}
          variant="ghost"
          disabled={nextStatus === status}
          onDone={reload}
        />
      </div>

      {/* internal note */}
      <div className="space-y-2 rounded-lg border border-[#21262d] bg-[#161b22] p-4">
        <h3 className="text-sm font-bold">ملاحظة داخلية</h3>
        <p className="text-[11px] text-[#8b949e]">للفريق فقط — لا تصل صاحب التذكرة.</p>
        <textarea
          value={noteAr}
          onChange={(e) => setNoteAr(e.target.value)}
          rows={3}
          placeholder="ملاحظة داخلية…"
          className={INPUT}
        />
        <OpRunner
          opKey="support.ticket.note.add"
          input={{ ticketId, noteAr }}
          triggerLabel="إضافة ملاحظة"
          riskTier="STANDARD"
          requiresReason={false}
          variant="ghost"
          disabled={noteAr.trim().length < 2}
          onDone={reload}
        />
      </div>

      {/* outbound reply */}
      <div className="space-y-2 rounded-lg border border-amber-500/30 bg-[#161b22] p-4">
        <h3 className="text-sm font-bold">الرد على صاحب التذكرة</h3>
        <p className="text-[11px] text-amber-300">
          يُرسَل بالبريد إلى صاحب التذكرة — غير قابل للاسترجاع.
        </p>
        <textarea
          value={replyAr}
          onChange={(e) => setReplyAr(e.target.value)}
          rows={3}
          placeholder="نص الرد…"
          className={INPUT}
        />
        <OpRunner
          opKey="support.ticket.reply"
          input={{ ticketId, replyAr }}
          triggerLabel="إرسال الرد"
          riskTier="STANDARD"
          requiresReason={false}
          variant="primary"
          disabled={replyAr.trim().length < 2}
          onDone={reload}
        />
      </div>
    </div>
  );
}
