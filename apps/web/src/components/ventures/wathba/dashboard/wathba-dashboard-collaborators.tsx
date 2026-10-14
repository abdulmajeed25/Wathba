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
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    setLoaded(false); setLoadFailed(false);
    try {
      const res = await fetch(`/api/collaborators/${projectId}`);
      if (!res.ok) throw new Error('unavailable');
      const data = (await res.json()) as { items: Collaborator[] };
      if (!Array.isArray(data.items)) throw new Error('invalid response');
      setItems(data.items);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const invite = async (): Promise<void> => {
    if (!email.trim() || busy || !loaded || loadFailed) return;
    setBusy(true);
    setError(null);
    setNotice(null);
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
      if (!Array.isArray(j.items)) { setError('تعذر تأكيد قائمة الفريق بعد الإضافة. أعد تحميل الفريق قبل المحاولة مجددًا.'); setLoadFailed(true); return; }
      setItems(j.items);
      setEmail('');
      setNotice('أُضيف محرر التحديثات. يستطيع فتح «مساحات أشارك فيها» من قائمة حسابه.');
    } catch {
      setError('خطأ في الاتصال');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string): Promise<void> => {
    if (busy || !loaded || loadFailed) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/collaborators/${projectId}/${userId}`, { method: 'DELETE' });
      if (!res.ok) { setError('تعذّر سحب الوصول. لم نؤكد إزالة المتعاون.'); return; }
      setItems(prev => prev.filter(c => c.userId !== userId));
      setNotice('سُحب وصول المتعاون إلى تحديثات الحملة.');
    } catch {
      setError('تعذر تأكيد سحب الوصول. أعد تحميل الفريق للتحقق من النتيجة.');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary, #3b4942)', margin: '0 0 12px', lineHeight: 1.7 }}>
        أضِف متعاونين يساعدونك في نشر <b>التحديثات</b>. لا يملك المتعاون أي صلاحية مالية أو على دورة
        حياة الحملة. تبقى إدارة هذه القرارات لديك ولدى إدارة وثبة بحسب الصلاحيات.
      </p>
      <p style={{ fontSize: 13, marginBottom: 12 }}>يفتح المحرر «مساحات أشارك فيها» من حسابه. الإزالة تسحب وصوله للطلبات اللاحقة، والتحديثات التي حفظها تبقى في الحملة.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="بريد المتعاون (مسجّل في وثبة)"
          aria-label="بريد المتعاون"
          style={{
            flex: 1, minWidth: 0, width: '100%', minHeight: 44, padding: '9px 11px', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit',
            border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))', background: 'var(--bg-base, #fff)', color: 'var(--text-primary, var(--text-primary))',
          }}
        />
        <button
          type="button"
          onClick={() => void invite()}
          disabled={busy || !email.trim() || !loaded || loadFailed}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            minHeight: 44,
            background: 'var(--brand-primary, #05a661)', color: 'var(--on-brand, #08130d)', cursor: busy ? 'wait' : 'pointer', opacity: busy || !email.trim() ? 0.6 : 1,
          }}
        >
          {busy ? 'جارٍ…' : 'إضافة'}
        </button>
      </div>
      {error && <p role="alert" style={{ fontSize: 12.5, color: 'var(--err-ink)', margin: '0 0 10px' }}>{error}</p>}
      {notice && <p role="status" style={{ marginBottom: 12 }}>{notice}</p>}
      {!loaded && <p role="status">جارٍ تحميل الفريق…</p>}
      {loadFailed && <div role="alert"><p>تعذرت قراءة الفريق؛ لا يمكن تأكيد الأعضاء الحاليين.</p><button type="button" onClick={() => void load()} disabled={busy} style={{ minHeight: 44, textDecoration: 'underline' }}>إعادة تحميل الفريق</button></div>}
      {loaded && !loadFailed && items.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary, var(--muted2))', margin: 0 }}>لا يوجد متعاونون بعد.</p>
      )}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((c) => (
            <div key={c.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-base, #f8faf6)', border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))' }}>
              <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                {c.email && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary, var(--muted2))' }}>{c.email}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: 'var(--brand-ink, var(--pos-ink))', background: 'rgba(5,166,97,0.10)' }}>{c.role === 'EDITOR' ? 'محرِّر' : 'دور غير مدعوم'}</span>
              <button
                type="button"
                disabled={busy || !loaded || loadFailed}
                onClick={() => void remove(c.userId)}
                style={{ minHeight: 44, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, color: 'var(--err-ink)', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}
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
