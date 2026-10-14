'use client';

import { useRef, useState } from 'react';

import type { ApiUpdateRow } from '../wathba-updates';
import { useConfirm } from '../wathba-feedback';

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
  const confirmDlg = useConfirm();
  const [titleAr, setTitleAr] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'BACKERS_ONLY'>('PUBLIC');
  const [publishAt, setPublishAt] = useState(''); // datetime-local; empty = now
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  const reset = (): void => {
    setTitleAr('');
    setBodyAr('');
    setVisibility('PUBLIC');
    setPublishAt('');
    setError(null);
    setEditingId(null);
  };

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!titleAr.trim() || !bodyAr.trim()) {
      setError('الرجاء تعبئة العنوان والمحتوى.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/updates/${projectId}${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleAr: titleAr.trim(),
          bodyAr: bodyAr.trim(),
          visibility,
          ...(!editingId && publishAt ? { publishAt: new Date(publishAt).toISOString() } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body?.message ?? 'تعذّر حفظ التحديث. تحقق من اتصالك وصلاحية التحرير ثم حاول مجددًا.');
        return;
      }
      const next = (await res.json()) as ApiUpdateRow;
      setRows((prev) => editingId ? prev.map(row => row.id === editingId ? next : row) : [next, ...prev]);
      setNotice(editingId ? 'حُفظ تعديل التحديث.' : 'حُفظ التحديث بنجاح.');
      reset();
    } catch {
      setError('تعذّر الاتصال بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    if (submitting || actionBusy) return;
    if (!(await confirmDlg({ title: 'حذف هذا التحديث؟', confirmLabel: 'حذف', danger: true }))) return;
    setActionBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/updates/${projectId}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) { setError('تعذّر حذف التحديث. قد يكون وصولك تغير؛ بقي المحتوى ظاهرًا حتى نتأكد.'); return; }
      setRows(prev => prev.filter(row => row.id !== id));
      if (editingId === id) reset();
      setNotice('حُذف التحديث.');
    } catch {
      setError('تعذّر تأكيد الحذف. أعد تحميل الصفحة للتحقق من النتيجة.');
    } finally { setActionBusy(false); }
  };

  const onPin = async (id: string): Promise<void> => {
    if (submitting || actionBusy) return;
    setActionBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/updates/${projectId}/${id}/pin`, { method: 'PATCH' });
      if (!res.ok) {
        setError('تعذّر تغيير التثبيت. تحقق من صلاحية التحرير ثم حاول مجددًا.');
      } else {
        const next = (await res.json()) as ApiUpdateRow;
        setRows((prev) => prev.map((r) => (r.id === id ? next : r)));
        setNotice(next.pinned ? 'ثُبّت التحديث.' : 'أُلغي تثبيت التحديث.');
      }
    } catch {
      setError('تعذّر تأكيد التثبيت. أعد تحميل الصفحة للتحقق من النتيجة.');
    } finally { setActionBusy(false); }
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          التحديثات
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          انشر تحديثات مرقّمة لداعميك (#1، #2 …). اجعلها عامة أو للداعمين فقط، وانشرها الآن
          أو جدولها لوقت لاحق. ثبّت الأهم ليظهر في الأعلى.
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
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{editingId ? 'تعديل التحديث' : 'تحديث جديد'}</h2>
        <label htmlFor="campaign-update-title">عنوان التحديث</label>
        <input
          id="campaign-update-title"
          ref={titleInput}
          type="text"
          required
          maxLength={200}
          placeholder="عنوان التحديث"
          value={titleAr}
          onChange={(e) => setTitleAr(e.target.value)}
          disabled={submitting || actionBusy}
          style={inputStyle}
        />
        <label htmlFor="campaign-update-body">محتوى التحديث</label>
        <textarea
          id="campaign-update-body"
          required
          rows={6}
          maxLength={20_000}
          placeholder="اكتب محتوى التحديث هنا…"
          value={bodyAr}
          onChange={(e) => setBodyAr(e.target.value)}
          disabled={submitting || actionBusy}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 140, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12.5, color: 'var(--text-secondary, #3b4942)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            من يرى التحديث؟
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'BACKERS_ONLY')}
              disabled={submitting || actionBusy}
              style={{ ...inputStyle, padding: '8px 10px' }}
            >
              <option value="PUBLIC">الجميع (عام)</option>
              <option value="BACKERS_ONLY">الداعمون فقط</option>
            </select>
          </label>
          {!editingId && <label style={{ fontSize: 12.5, color: 'var(--text-secondary, #3b4942)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            جدولة النشر (اختياري)
            <input
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
              disabled={submitting || actionBusy}
              style={{ ...inputStyle, padding: '8px 10px' }}
            />
          </label>}
        </div>
        {editingId && <p style={{ fontSize: 13 }}>تعديل النص والجمهور يحافظ على موعد النشر الحالي.</p>}
        {error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: 'var(--err-ink)',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            {error}
          </div>
        )}
        {notice && <p role="status">{notice}</p>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <button
            type="submit"
            disabled={submitting || actionBusy}
            style={{
              background: 'var(--brand-primary, #05a661)',
              color: 'var(--on-brand, #08130d)',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              minHeight: 44,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: submitting ? 'progress' : 'pointer',
            }}
          >
            {submitting ? 'جارٍ الحفظ…' : editingId ? 'حفظ التعديل' : 'نشر التحديث'}
          </button>
          {editingId && <button type="button" disabled={submitting || actionBusy} onClick={reset} style={{ minHeight: 44, padding: '10px 16px', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>إلغاء التعديل</button>}
        </div>
      </form>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        التحديثات المحفوظة والمجدولة
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
              busy={submitting || actionBusy}
              onEdit={() => { setEditingId(u.id); setTitleAr(u.titleAr); setBodyAr(u.bodyAr ?? ''); setVisibility(u.visibility ?? 'PUBLIC'); setError(null); setNotice(null); titleInput.current?.focus(); }}
              onDelete={() => {
                void onDelete(u.id);
              }}
              onPin={() => {
                void onPin(u.id);
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
  color: 'var(--text-primary, var(--text-primary))',
  background: '#fff',
};

function UpdateAdminRow({
  row,
  onDelete,
  onPin,
  onEdit,
  busy,
}: {
  row: ApiUpdateRow;
  onDelete: () => void;
  onPin: () => void;
  onEdit: () => void;
  busy: boolean;
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
            color: 'var(--brand-ink, var(--pos-ink))',
            display: 'inline-grid',
            placeItems: 'center',
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          #{row.orderNum}
        </span>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: 0 }}>{row.titleAr}</h3>
        {row.pinned && <Badge tone="brand">📌 مثبَّت</Badge>}
        {row.visibility === 'BACKERS_ONLY' && <Badge tone="amber">🔒 للداعمين فقط</Badge>}
        {row.scheduled && <Badge tone="indigo">⏰ مجدول {formatDateAr(row.publishAt ?? row.date)}</Badge>}
        <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--text-tertiary, var(--muted2))' }}>
          {dateAr}
        </span>
      </div>
      <p
        style={{
          fontSize: 13.5,
          color: 'var(--text-primary, var(--text-primary))',
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
          flexWrap: 'wrap',
          fontSize: 12.5,
          color: 'var(--text-tertiary, var(--muted2))',
          marginTop: 4,
        }}
      >
        <span>❤ {row.likeCount.toLocaleString('en-US')}</span>
        <span>💬 {row.commentCount.toLocaleString('en-US')}</span>
        <button type="button" disabled={busy} onClick={onEdit} style={{ minHeight: 44, padding: '5px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>تعديل</button>
        <button
          type="button"
          disabled={busy}
          onClick={onPin}
          style={{
            marginInlineStart: 'auto',
            fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
            minHeight: 44,
            color: row.pinned ? 'var(--brand-ink, var(--pos-ink))' : 'var(--text-primary, var(--text-primary))',
            background: row.pinned ? 'rgba(5,166,97,0.10)' : 'transparent',
            border: `1px solid ${row.pinned ? 'rgba(5,166,97,0.4)' : 'rgba(18,33,26,0.16)'}`,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {row.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          style={{
            fontSize: 12,
            minHeight: 44,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 8,
            color: 'var(--err-ink)',
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

function Badge({ tone, children }: { tone: 'brand' | 'amber' | 'indigo'; children: React.ReactNode }): React.ReactElement {
  const palette = {
    brand: { fg: 'var(--brand-ink, var(--pos-ink))', bg: 'rgba(5,166,97,0.10)' },
    amber: { fg: 'var(--gold-ink)', bg: 'rgba(245,158,11,0.12)' },
    indigo: { fg: 'var(--purple-ink)', bg: 'rgba(99,102,241,0.12)' },
  }[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: palette.fg, background: palette.bg }}>
      {children}
    </span>
  );
}

function formatDateAr(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
