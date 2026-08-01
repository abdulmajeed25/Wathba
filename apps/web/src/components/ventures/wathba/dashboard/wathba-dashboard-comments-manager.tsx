'use client';

import { useState, useTransition } from 'react';

import type { ApiCommentRow } from '../wathba-comments';
import { useConfirm } from '../wathba-feedback';

/**
 * Creator-side comment moderation list. Each row exposes Pin, Hide, Delete
 * actions that hit the Next route proxies (`/api/comments/...`). Optimistic UI
 * with a quiet rollback when the API rejects.
 */
export function DashboardCommentsManager({
  projectId,
  initial,
}: {
  projectId: string;
  initial: ApiCommentRow[];
}): React.ReactElement {
  const [rows, setRows] = useState<ApiCommentRow[]>(initial);
  const confirmDlg = useConfirm();
  // CC-07 — creator replies, keyed by parent comment id. Optimistic: a temp
  // row appears immediately, then is replaced by the server row or rolled back.
  const [replies, setReplies] = useState<Record<string, ApiCommentRow[]>>({});

  const onReply = async (parentId: string, body: string): Promise<boolean> => {
    const tempId = `temp-${parentId}-${body.length}`;
    const temp: ApiCommentRow = {
      id: tempId, userId: 'me', userName: 'أنت', isCreator: true,
      pinned: false, hidden: false, likeCount: 0, bodyAr: body,
      parentId, date: new Date().toISOString(),
    };
    setReplies((prev) => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), temp] }));
    try {
      const res = await fetch(`/api/comments/${projectId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bodyAr: body, parentId }),
      });
      if (!res.ok) {
        setReplies((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? []).filter((r) => r.id !== tempId) }));
        return false;
      }
      const created = (await res.json()) as ApiCommentRow;
      setReplies((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] ?? []).map((r) => (r.id === tempId ? created : r)),
      }));
      return true;
    } catch {
      setReplies((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? []).filter((r) => r.id !== tempId) }));
      return false;
    }
  };

  const onPin = async (id: string): Promise<void> => {
    const snapshot = rows;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r)),
    );
    try {
      const res = await fetch(`/api/comments/${projectId}/${id}/pin`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        setRows(snapshot);
      } else {
        const next = (await res.json()) as ApiCommentRow;
        setRows((prev) => prev.map((r) => (r.id === id ? next : r)));
      }
    } catch {
      setRows(snapshot);
    }
  };

  const onHide = async (id: string): Promise<void> => {
    const snapshot = rows;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, hidden: !r.hidden, bodyAr: r.hidden ? r.bodyAr : null } : r,
      ),
    );
    try {
      const res = await fetch(`/api/comments/${projectId}/${id}/hide`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        setRows(snapshot);
      } else {
        const next = (await res.json()) as ApiCommentRow;
        setRows((prev) => prev.map((r) => (r.id === id ? next : r)));
      }
    } catch {
      setRows(snapshot);
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    if (!(await confirmDlg({ title: 'حذف هذا التعليق نهائياً؟', confirmLabel: 'حذف', danger: true }))) return;
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/comments/${projectId}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) setRows(snapshot);
    } catch {
      setRows(snapshot);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          التعليقات
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          أدِر تعليقات حملتك — ثبّت المهمّ، أخفِ المخالفات، أو احذف.
        </p>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: 20,
            background: 'var(--bg-elevated, #fff)',
            border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
            borderRadius: 12,
            fontSize: 14,
            color: 'var(--text-secondary, #3b4942)',
            textAlign: 'center',
          }}
        >
          لا توجد تعليقات على هذه الحملة بعد.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((c) => (
            <CommentManagerRow
              key={c.id}
              row={c}
              replies={replies[c.id] ?? []}
              onReply={(body) => onReply(c.id, body)}
              onPin={() => {
                void onPin(c.id);
              }}
              onHide={() => {
                void onHide(c.id);
              }}
              onDelete={() => {
                void onDelete(c.id);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CommentManagerRow({
  row,
  replies,
  onReply,
  onPin,
  onHide,
  onDelete,
}: {
  row: ApiCommentRow;
  replies: ApiCommentRow[];
  onReply: (body: string) => Promise<boolean>;
  onPin: () => void;
  onHide: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState(false);
  const dateAr = formatDateAr(row.date);

  const submitReply = async (): Promise<void> => {
    const body = replyText.trim();
    if (!body) return;
    setReplyBusy(true);
    setReplyError(false);
    const ok = await onReply(body);
    setReplyBusy(false);
    if (ok) {
      setReplyText('');
      setReplyOpen(false);
    } else {
      setReplyError(true);
    }
  };

  return (
    <article
      style={{
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: pending ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>{row.userName}</span>
        {row.isCreator && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 20,
              color: 'var(--brand-ink, #047649)',
              border: '1px solid rgba(5,166,97,0.5)',
              background: 'rgba(5,166,97,0.08)',
            }}
          >
            صاحب المشروع
          </span>
        )}
        {row.pinned && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 20,
              color: 'var(--brand-ink, #047649)',
              background: 'rgba(5,166,97,0.10)',
            }}
          >
            📌 مثبَّت
          </span>
        )}
        {row.hidden && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 20,
              color: '#9a5a06',
              background: 'rgba(245,158,11,0.12)',
            }}
          >
            مخفي
          </span>
        )}
        {(row.reportCount ?? 0) > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 20,
              color: '#b91c1c',
              background: 'rgba(239,68,68,0.10)',
            }}
          >
            🚩 مُبلَّغ ({row.reportCount})
          </span>
        )}
        <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--text-tertiary, #5d6b62)' }}>
          {dateAr}
        </span>
      </div>

      <p style={{ fontSize: 14, color: 'var(--text-primary, #16201b)', margin: 0, lineHeight: 1.65 }}>
        {row.hidden ? <em style={{ color: 'var(--text-tertiary, #5d6b62)' }}>تم إخفاء هذا التعليق</em> : row.bodyAr}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ManagerButton
          onClick={() => {
            startTransition(onPin);
          }}
          active={row.pinned}
          label={row.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
        />
        <ManagerButton
          onClick={() => {
            startTransition(onHide);
          }}
          active={row.hidden}
          label={row.hidden ? 'إظهار' : 'إخفاء'}
        />
        <ManagerButton
          onClick={() => setReplyOpen((v) => !v)}
          active={replyOpen}
          label="رد"
        />
        <ManagerButton
          onClick={() => {
            startTransition(onDelete);
          }}
          danger
          label="حذف"
        />
      </div>

      {/* CC-07 — creator replies rendered inline, each with the owner badge. */}
      {replies.length > 0 && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            marginInlineStart: 16, paddingInlineStart: 12,
            borderInlineStart: '2px solid rgba(5,166,97,0.25)',
          }}
        >
          {replies.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', opacity: r.id.startsWith('temp-') ? 0.6 : 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{r.userName}</span>
              <span
                style={{
                  fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                  color: 'var(--brand-ink, #047649)', border: '1px solid rgba(5,166,97,0.5)',
                  background: 'rgba(5,166,97,0.08)',
                }}
              >
                صاحب المشروع
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--text-primary, #16201b)', lineHeight: 1.6 }}>{r.bodyAr}</span>
            </div>
          ))}
        </div>
      )}

      {replyOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="اكتب ردك كصاحب المشروع…"
            aria-label="نص الرد"
            rows={2}
            style={{
              width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13.5,
              padding: '9px 11px', borderRadius: 10,
              border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
              background: 'var(--bg-base, #f8faf6)', color: 'var(--text-primary, #16201b)',
            }}
          />
          {replyError && (
            <span role="alert" style={{ fontSize: 12.5, color: '#b91c1c' }}>تعذّر إرسال الرد — أعد المحاولة.</span>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => void submitReply()}
              disabled={replyBusy || !replyText.trim()}
              style={{
                fontSize: 12.5, fontWeight: 700, padding: '7px 16px', borderRadius: 10,
                cursor: replyBusy ? 'wait' : 'pointer', border: 'none',
                background: 'var(--brand-primary, #05a661)', color: 'var(--on-brand, #08130d)',
                opacity: replyBusy || !replyText.trim() ? 0.6 : 1, fontFamily: 'inherit',
              }}
            >
              {replyBusy ? 'جارٍ الإرسال…' : 'إرسال الرد'}
            </button>
            <ManagerButton onClick={() => { setReplyOpen(false); setReplyError(false); }} label="إلغاء" />
          </div>
        </div>
      )}
    </article>
  );
}

function ManagerButton({
  onClick,
  label,
  active = false,
  danger = false,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  danger?: boolean;
}): React.ReactElement {
  const palette = danger
    ? { fg: '#b91c1c', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' }
    : active
      ? { fg: 'var(--brand-ink, #047649)', bg: 'rgba(5,166,97,0.10)', border: 'rgba(5,166,97,0.4)' }
      : { fg: 'var(--text-primary, #16201b)', bg: 'transparent', border: 'rgba(18,33,26,0.12)' };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12.5,
        fontWeight: 600,
        padding: '6px 14px',
        borderRadius: 10,
        cursor: 'pointer',
        color: palette.fg,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

function formatDateAr(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
