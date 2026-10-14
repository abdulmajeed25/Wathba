'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function challengeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'api.moyasar.com' && !u.port && !u.username && !u.password &&
      u.pathname.startsWith('/v1/transaction_auths/') && !u.hash ? u.href : null;
  } catch { return null; }
}

export function AuthorizationRecovery({ pledgeId, autoCheck = false }: { pledgeId: string; autoCheck?: boolean }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('يمكنك التحقق من الحجز المحفوظ دون إنشاء دفع جديد.');
  const [url, setUrl] = useState<string | null>(null);
  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setUrl(null);
    try {
      const response = await fetch(`/api/pledges/${encodeURIComponent(pledgeId)}/verify-authorization`, { method: 'POST' });
      const result = await response.json() as { outcome?: string; transactionUrl?: string };
      if (!response.ok) throw new Error();
      if (result.outcome === 'confirmed' || result.outcome === 'uncharged') {
        setMessage(result.outcome === 'confirmed' ? 'تأكد الحجز وسُجّل دعمك. نحدّث النتيجة الآن.' : 'أكد المزود أن هذه المحاولة لم تحصّل مبلغًا. نحدّث حالتها الآن.');
        router.refresh();
      } else if (result.outcome === 'challenge') {
        const verifiedUrl = challengeUrl(result.transactionUrl);
        setUrl(verifiedUrl);
        setMessage(verifiedUrl ? 'يلزم إكمال التحقق لدى البنك للحجز نفسه. لم يُحتسب دعمك بعد.' : 'ما زال تحقق البنك غير مكتمل، ولم يصل رابط صالح للاستكمال. لا تبدأ دفعًا جديدًا.');
      } else {
        setMessage('تحتاج محاولة الحجز إلى مراجعة؛ قد تكون شروط الحملة أو المكافأة تغيرت. لم نحتسب دعمًا جديدًا أو نرسل خصمًا آخر.');
      }
    } catch {
      setMessage('تعذر التأكد من نتيجة الحجز. يمكنك التحقق لاحقًا؛ لا تدفع مجددًا قبل حسم النتيجة.');
    } finally { inFlight.current = false; setBusy(false); }
  }, [pledgeId, router]);
  useEffect(() => { if (autoCheck && !started.current) { started.current = true; void check(); } }, [autoCheck, check]);
  return <section aria-label="متابعة حجز الدفع" style={{ margin: '16px auto', maxWidth: 460, padding: 16, border: '1px solid rgba(var(--ink-rgb),.16)', borderRadius: 14 }}>
    <p role="status" style={{ lineHeight: 1.8, marginBottom: 12 }}>{busy ? 'جارٍ قراءة نتيجة الحجز…' : message}</p>
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
      {url && <a href={url} rel="noreferrer" style={{ ...action, background: 'var(--grad)', color: 'var(--on-accent)' }}>إكمال التحقق لدى البنك</a>}
      <button type="button" onClick={() => void check()} disabled={busy} style={action}>{busy ? 'جارٍ التحقق…' : 'التحقق من الحجز'}</button>
    </div>
  </section>;
}

const action: React.CSSProperties = { font: 'inherit', fontWeight: 700, borderRadius: 10, border: '1px solid rgba(var(--ink-rgb),.2)',
  padding: '10px 16px', minHeight: 44, color: 'var(--text)', background: 'var(--card)', cursor: 'pointer', textDecoration: 'none' };
