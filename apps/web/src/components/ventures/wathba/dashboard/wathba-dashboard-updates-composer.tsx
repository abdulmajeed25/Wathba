'use client';

import { useState } from 'react';

import type { ApiUpdateRow } from '../wathba-updates';

/**
 * Creator-side updates composer + list. Composer POSTs through the Next route
 * proxy at `/api/updates/:projectId`; on success the new row is prepended to
 * the visible list so the creator sees the new "#N" immediately.
 */
export function DashboardUpdatesComposer({
  projectId,
  initial,
}: {
  projectId: string;
  initial: ApiUpdateRow[];
}): React.ReactElement {
  const [rows, setRows] = useState<ApiUpdateRow[]>(initial);
  const [titleAr, setTitleAr] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setTitleAr('');
    setBodyAr('');
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!titleAr.trim() || !bodyAr.trim()) {
      setError('الرجاء تعبئة العنوان والمحتوى.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/updates/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleAr: titleAr.trim(), bodyAr: bodyAr.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body?.message ?? 'تعذّر نشر التحديث.');
        return;
      }
      const next = (await res.json()) as ApiUpdateRow;
      setRows((prev) => [next, ...prev]);
      reset();
    } catch {
      setError('تعذّر الاتصال بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    if (!confirm('هل تريد حذف هذا التحديث؟')) return;
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/updates/${projectId}/${id}`, {
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
          التحديثات
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          انشر تحديثات مرقّمة لداعميك (#1، #2 …) — ستظهر فوراً في صفحة الحملة.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          void onSubmit(e);
        }}
        style={{
          background: 'var(--bg-elevated, #fff)',
          border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
          borderRadius: 12,
          padding: 18,
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <input
          type="text"
          required
          maxLength={200}
          placeholder="عنوان التحديث"
          value={titleAr}
          onChange={(e) => setTitleAr(e.target.value)}
          disabled={submitting}
          style={inputStyle}
        />
        <textarea
          required
          rows={6}
          maxLength={20_000}
          placeholder="اكتب محتوى التحديث هنا…"
          value={bodyAr}
          onChange={(e) => setBodyAr(e.target.value)}
          disabled={submitting}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 140, fontFamily: 'inherit' }}
        />
        {error && (
          <div
            style={{
              fontSize: 13,
              color: '#b91c1c',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: 'var(--brand-primary, #05a661)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: submitting ? 'progress' : 'pointer',
            }}
          >
            {submitting ? 'جاري النشر…' : 'نشر التحديث'}
          </button>
        </div>
      </form>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        التحديثات المنشورة
      </h2>
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
          لم تنشر أي تحديث بعد.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((u) => (
            <UpdateAdminRow
              key={u.id}
              row={u}
              onDelete={() => {
                void onDelete(u.id);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle, rgba(18,33,26,0.18))',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: 'var(--text-primary, #16201b)',
  background: '#fff',
};

function UpdateAdminRow({
  row,
  onDelete,
}: {
  row: ApiUpdateRow;
  onDelete: () => void;
}): React.ReactElement {
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
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: 'rgba(5,166,97,0.12)',
            color: 'var(--brand-primary, #05a661)',
            display: 'inline-grid',
            placeItems: 'center',
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          #{row.orderNum}
        </span>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: 0 }}>{row.titleAr}</h3>
        <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--text-tertiary, #5d6b62)' }}>
          {dateAr}
        </span>
      </div>
      <p
        style={{
          fontSize: 13.5,
          color: 'var(--text-primary, #16201b)',
          margin: 0,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}
      >
        {row.bodyAr}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontSize: 12.5,
          color: 'var(--text-tertiary, #5d6b62)',
          marginTop: 4,
        }}
      >
        <span>❤ {row.likeCount.toLocaleString('en-US')}</span>
        <span>💬 {row.commentCount.toLocaleString('en-US')}</span>
        <button
          type="button"
          onClick={onDelete}
          style={{
            marginInlineStart: 'auto',
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 8,
            color: '#ef4444',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          حذف
        </button>
      </div>
    </article>
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
