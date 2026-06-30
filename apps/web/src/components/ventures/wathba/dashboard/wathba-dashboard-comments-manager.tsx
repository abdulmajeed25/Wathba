'use client';

import { useState, useTransition } from 'react';

import type { ApiCommentRow } from '../wathba-comments';

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
    if (!confirm('هل تريد حذف هذا التعليق نهائياً؟')) return;
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
  onPin,
  onHide,
  onDelete,
}: {
  row: ApiCommentRow;
  onPin: () => void;
  onHide: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const dateAr = formatDateAr(row.date);

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
              color: 'var(--brand-primary, #05a661)',
              border: '1px solid rgba(5,166,97,0.5)',
              background: 'rgba(5,166,97,0.08)',
            }}
          >
            الـمبدع
          </span>
        )}
        {row.pinned && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 20,
              color: 'var(--brand-primary, #05a661)',
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
              color: '#a96400',
              background: 'rgba(245,158,11,0.12)',
            }}
          >
            مخفي
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
          onClick={() => {
            startTransition(onDelete);
          }}
          danger
          label="حذف"
        />
      </div>
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
    ? { fg: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' }
    : active
      ? { fg: 'var(--brand-primary, #05a661)', bg: 'rgba(5,166,97,0.10)', border: 'rgba(5,166,97,0.4)' }
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
