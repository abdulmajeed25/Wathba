'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { WathbaCreatorTab } from '../wathba-creator-tab';
import type { ApiCreatorCollaborator, ApiCreatorProfile } from '@/lib/api/wathba';

/**
 * "ملفي كمبدع" — the single source of truth editor for the public Creator
 * Profile (rendered by `WathbaCreatorTab` on every project page). The page
 * shows a read-only preview of how the public sees the creator on top, then
 * the edit form below. Save calls PATCH /api/creators/:userId which proxies
 * to the bearer-protected upstream endpoint.
 *
 * Backend contract (assumed; built in parallel by sibling agent):
 *   PATCH /v1/creators/:userId  body { bioAr?, websiteUrl?, collaborators? }
 *
 * If the upstream endpoint isn't ready yet (404), we surface "API not ready"
 * to the creator and keep the form filled so nothing is lost.
 */

const BIO_MAX = 4000;

interface DraftCollaborator {
  nameAr: string;
  role: string;
  avatarUrl: string;
}

interface DraftState {
  bioAr: string;
  websiteUrl: string;
  collaborators: DraftCollaborator[];
}

function profileToDraft(p: ApiCreatorProfile | null): DraftState {
  if (!p) return { bioAr: '', websiteUrl: '', collaborators: [] };
  return {
    bioAr: p.bioAr ?? '',
    websiteUrl: p.websiteUrl ?? '',
    collaborators: p.collaborators.map((c) => ({
      nameAr: c.nameAr,
      role: c.role ?? '',
      avatarUrl: c.avatarUrl ?? '',
    })),
  };
}

function draftToPayload(draft: DraftState): {
  bioAr: string;
  websiteUrl: string | null;
  collaborators: ApiCreatorCollaborator[];
} {
  const collaborators: ApiCreatorCollaborator[] = draft.collaborators
    .filter((c) => c.nameAr.trim().length > 0)
    .map((c) => {
      const out: ApiCreatorCollaborator = { nameAr: c.nameAr.trim() };
      if (c.role.trim()) out.role = c.role.trim();
      if (c.avatarUrl.trim()) out.avatarUrl = c.avatarUrl.trim();
      return out;
    });
  return {
    bioAr: draft.bioAr,
    websiteUrl: draft.websiteUrl.trim() ? draft.websiteUrl.trim() : null,
    collaborators,
  };
}

function isValidUrl(s: string): boolean {
  if (!s.trim()) return true; // empty allowed (clears the field)
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function DashboardCreatorProfileEditor({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: ApiCreatorProfile | null;
}): React.ReactElement {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(profileToDraft(initialProfile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [apiNotReady, setApiNotReady] = useState(false);

  const urlInvalid = !isValidUrl(draft.websiteUrl);
  const bioOverLimit = draft.bioAr.length > BIO_MAX;
  const canSave = !busy && !urlInvalid && !bioOverLimit;

  const updateCollaborator = (idx: number, patch: Partial<DraftCollaborator>): void => {
    setDraft((d) => {
      const next = [...d.collaborators];
      const current = next[idx];
      if (!current) return d;
      next[idx] = { ...current, ...patch };
      return { ...d, collaborators: next };
    });
  };

  const addCollaborator = (): void => {
    setDraft((d) => ({
      ...d,
      collaborators: [...d.collaborators, { nameAr: '', role: '', avatarUrl: '' }],
    }));
  };

  const removeCollaborator = (idx: number): void => {
    setDraft((d) => ({
      ...d,
      collaborators: d.collaborators.filter((_, i) => i !== idx),
    }));
  };

  const uploadAvatar = async (file: File, idx: number): Promise<void> => {
    setError(null);
    try {
      const presignRes = await fetch('/api/media/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'avatar',
          mimeType: file.type || 'image/jpeg',
          sizeBytes: file.size,
        }),
      });
      if (!presignRes.ok) {
        throw new Error(`فشل تحضير الرفع (${presignRes.status})`);
      }
      const presign = (await presignRes.json()) as { url: string; publicUrl: string };
      const putRes = await fetch(presign.url, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'image/jpeg' },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`فشل رفع الصورة (${putRes.status})`);
      }
      updateCollaborator(idx, { avatarUrl: presign.publicUrl });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setToast(null);
    setApiNotReady(false);
    try {
      const payload = draftToPayload(draft);
      const res = await fetch(`/api/creators/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 404) {
        setApiNotReady(true);
        return;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`فشل الحفظ (${res.status}): ${body.slice(0, 160)}`);
      }
      setToast('تم حفظ ملفك العام.');
      router.refresh();
      // Auto-hide toast after 4s for a less sticky UX.
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>
          ملفي كمبدع
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #3b4942)', margin: 0 }}>
          هذا الملف يظهر للجمهور في كل مشروعاتك. تعديلاتك تنعكس فوراً على تبويب «المبدع»
          في صفحة كل حملة.
        </p>
      </header>

      {toast && (
        <div
          role="status"
          style={{
            padding: 12,
            background: 'rgba(5,166,97,0.10)',
            border: '1px solid rgba(5,166,97,0.32)',
            borderRadius: 10,
            color: '#057a48',
            fontSize: 14,
          }}
        >
          {toast}
        </div>
      )}

      {apiNotReady && (
        <div
          role="alert"
          style={{
            padding: 12,
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.32)',
            borderRadius: 10,
            color: '#9a5a06',
            fontSize: 14,
          }}
        >
          خدمة تعديل الملف لم تُفعَّل بعد على الخادم. حُفظت تعديلاتك في النموذج محلياً —
          سنُمكِّن الحفظ خلال الإطلاق القريب.
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: 12,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: 10,
            color: '#b91c1c',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          background: 'var(--bg-elevated, #fff)',
          border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
          borderRadius: 12,
          padding: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>كيف يراني الجمهور</h2>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>
            معاينة فقط — التعديلات تتم في النموذج أدناه
          </span>
        </div>
        <div
          style={{
            padding: 16,
            background: 'var(--bg-base, #f4f6f1)',
            borderRadius: 10,
          }}
        >
          <WathbaCreatorTab
            userId={userId}
            isAuthenticated={false}
            initialData={initialProfile}
          />
        </div>
      </section>

      <section
        style={{
          background: 'var(--bg-elevated, #fff)',
          border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
          borderRadius: 12,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>تعديل الملف</h2>

        <Field
          label="نبذة عنك"
          hint={`${draft.bioAr.length.toLocaleString('en-US')} / ${BIO_MAX.toLocaleString('en-US')} حرفاً`}
          hintColor={bioOverLimit ? '#b91c1c' : undefined}
        >
          <textarea
            value={draft.bioAr}
            onChange={(e) => setDraft((d) => ({ ...d, bioAr: e.target.value }))}
            rows={6}
            placeholder="اكتب نبذة قصيرة تعرّف بك وبخلفيتك ودوافعك. هذا أهم نص يقرأه الداعمون قبل أن يدعموا."
            style={{ ...inputStyle, fontFamily: 'inherit', lineHeight: 1.8, resize: 'vertical' }}
          />
        </Field>

        <Field
          label="الموقع الإلكتروني (اختياري)"
          hint={urlInvalid ? 'الرابط يجب أن يبدأ بـ http:// أو https://' : undefined}
          hintColor={urlInvalid ? '#b91c1c' : undefined}
        >
          <input
            type="url"
            value={draft.websiteUrl}
            onChange={(e) => setDraft((d) => ({ ...d, websiteUrl: e.target.value }))}
            placeholder="https://example.com"
            dir="ltr"
            style={{
              ...inputStyle,
              borderColor: urlInvalid
                ? 'rgba(239,68,68,0.5)'
                : 'var(--border-subtle, rgba(18,33,26,0.16))',
              textAlign: 'left',
            }}
          />
        </Field>

        <Field
          label="فريقك والمتعاونون"
          hint="أضف من ساهم معك في المشروع. تظهر أسماؤهم على صفحة كل حملة."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {draft.collaborators.length === 0 && (
              <div
                style={{
                  padding: 14,
                  background: 'var(--bg-base, #f4f6f1)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: 'var(--text-tertiary, #5d6b62)',
                  textAlign: 'center',
                }}
              >
                لا متعاونين بعد.
              </div>
            )}
            {draft.collaborators.map((c, idx) => (
              <CollaboratorRow
                key={idx}
                value={c}
                onChange={(patch) => updateCollaborator(idx, patch)}
                onRemove={() => removeCollaborator(idx)}
                onPickAvatar={(file) => void uploadAvatar(file, idx)}
              />
            ))}
            <button type="button" onClick={addCollaborator} style={ghostBtnStyle}>
              + إضافة متعاون
            </button>
          </div>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={() => setDraft(profileToDraft(initialProfile))}
            disabled={busy}
            style={secondaryBtnStyle}
          >
            تراجع
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            style={{ ...primaryBtnStyle, opacity: canSave ? 1 : 0.5 }}
          >
            {busy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
          </button>
        </div>
      </section>
    </div>
  );
}

function CollaboratorRow({
  value,
  onChange,
  onRemove,
  onPickAvatar,
}: {
  value: DraftCollaborator;
  onChange: (patch: Partial<DraftCollaborator>) => void;
  onRemove: () => void;
  onPickAvatar: (file: File) => void;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr 1fr auto',
        gap: 10,
        alignItems: 'center',
        padding: 12,
        background: 'var(--bg-base, #f4f6f1)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 10,
      }}
    >
      <AvatarPicker
        url={value.avatarUrl}
        name={value.nameAr || '?'}
        onPick={onPickAvatar}
      />
      <input
        type="text"
        value={value.nameAr}
        onChange={(e) => onChange({ nameAr: e.target.value })}
        placeholder="الاسم"
        style={inputStyle}
      />
      <input
        type="text"
        value={value.role}
        onChange={(e) => onChange({ role: e.target.value })}
        placeholder="الدور (مثال: مصمم، مهندس برمجيات)"
        style={inputStyle}
      />
      <button
        type="button"
        onClick={onRemove}
        title="حذف"
        style={{ ...ghostBtnStyle, color: '#b91c1c', whiteSpace: 'nowrap' }}
      >
        حذف
      </button>
    </div>
  );
}

function AvatarPicker({
  url,
  name,
  onPick,
}: {
  url: string;
  name: string;
  onPick: (file: File) => void;
}): React.ReactElement {
  return (
    <label
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'rgba(5,166,97,0.16)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
      title="غيّر الصورة"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          width={56}
          height={56}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span
          style={{
            fontWeight: 700,
            fontSize: 22,
            color: 'var(--brand-primary, #05a661)',
          }}
        >
          {name.slice(0, 1) || '?'}
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
    </label>
  );
}

function Field({
  label,
  hint,
  hintColor,
  children,
}: {
  label: string;
  hint?: string;
  hintColor?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #16201b)' }}>
          {label}
        </label>
        {hint && (
          <span style={{ fontSize: 12, color: hintColor ?? 'var(--text-tertiary, #5d6b62)' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--bg-elevated, #fff)',
  color: 'var(--text-primary, #16201b)',
  fontFamily: 'inherit',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'var(--brand-primary, #05a661)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'transparent',
  color: 'var(--text-secondary, #3b4942)',
  border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'transparent',
  border: '1px dashed var(--border-strong, rgba(18,33,26,0.16))',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
  color: 'var(--text-secondary, #3b4942)',
  fontFamily: 'inherit',
};
