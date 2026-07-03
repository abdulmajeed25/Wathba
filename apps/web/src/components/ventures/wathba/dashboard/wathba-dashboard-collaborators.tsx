'use client';

import { useEffect, useState } from 'react';

/**
 * Per-project collaborators (Creator-CC / CC-24). Owner invites existing users
 * by email; a collaborator gets CONTENT access (project updates). Money &
 * lifecycle controls stay owner-only.
 */
interface Collaborator {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  addedAt: string;
}

export function WathbaDashboardCollaborators({ projectId }: { projectId: string }): React.ReactElement {
  const [items, setItems] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async (): Promise<void> => {
    try {
      const res = await fetch(`/api/collaborators/${projectId}`);
      if (res.ok) {
        const data = (await res.json()) as { items: Collaborator[] };
        setItems(data.items ?? []);
      }
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const invite = async (): Promise<void> => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/collaborators/${projectId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { items?: Collaborator[]; message?: string };
      if (!res.ok) {
        setError(j.message ?? 'تعذّرت الإضافة');
        return;
      }
      setItems(j.items ?? []);
      setEmail('');
    } catch {
      setError('خطأ في الاتصال');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string): Promise<void> => {
    const snapshot = items;
    setItems((prev) => prev.filter((c) => c.userId !== userId));
    try {
      const res = await fetch(`/api/collaborators/${projectId}/${userId}`, { method: 'DELETE' });
      if (!res.ok) setItems(snapshot);
    } catch {
      setItems(snapshot);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', margin: '0 0 12px', lineHeight: 1.7 }}>
        أضِف متعاونين يساعدونك في نشر <b>التحديثات</b>. لا يملك المتعاون أي صلاحية مالية أو على دورة
        حياة الحملة — الإلغاء والإيقاف والدفعات لك وحدك.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="بريد المتعاون (مسجّل في وثبة)"
          aria-label="بريد المتعاون"
          style={{
            flex: 1, minWidth: 220, padding: '9px 11px', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit',
            border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))', background: 'var(--bg-base, #fff)', color: 'var(--text-primary, #16201b)',
          }}
        />
        <button
          type="button"
          onClick={() => void invite()}
          disabled={busy || !email.trim()}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            background: 'var(--brand-primary, #05a661)', color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy || !email.trim() ? 0.6 : 1,
          }}
        >
          {busy ? 'جارٍ…' : 'إضافة'}
        </button>
      </div>
      {error && <p role="alert" style={{ fontSize: 12.5, color: '#ef4444', margin: '0 0 10px' }}>{error}</p>}
      {loaded && items.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary, #5d6b62)', margin: 0 }}>لا يوجد متعاونون بعد.</p>
      )}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((c) => (
            <div key={c.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-base, #f8faf6)', border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                {c.email && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary, #5d6b62)' }}>{c.email}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: 'var(--brand-primary, #05a661)', background: 'rgba(5,166,97,0.10)' }}>محرِّر</span>
              <button
                type="button"
                onClick={() => void remove(c.userId)}
                style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, color: '#ef4444', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                إزالة
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
