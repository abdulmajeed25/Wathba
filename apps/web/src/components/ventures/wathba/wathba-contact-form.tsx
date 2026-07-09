'use client';

import { useState } from 'react';

import { useToast } from './wathba-feedback';
import { Icon } from './wathba-icons';

/**
 * STAKES/S-15 (H4) — «تواصل معنا» that actually delivers: POST /api/support
 * (stored server-side + forwarded to the support inbox). Anonymous-friendly;
 * 4-state (idle / sending / sent / error), WCAG-labelled, RTL.
 */

const TOPICS: Array<{ value: string; label: string }> = [
  { value: 'support', label: 'مشكلة تقنية' },
  { value: 'billing', label: 'دفعات وتعهّدات' },
  { value: 'report', label: 'بلاغ عن محتوى' },
  { value: 'partnership', label: 'شراكات' },
  { value: 'other', label: 'أخرى' },
];

export function WathbaContactForm() {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (state === 'sending') return;
    setError(null);
    setState('sending');
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          topic: fd.get('topic'),
          messageAr: fd.get('messageAr'),
        }),
      });
      if (res.status === 429) throw new Error('طلبات كثيرة — انتظر دقيقة ثم حاول مجدداً.');
      if (!res.ok) throw new Error('تعذّر الإرسال. حاول مرة أخرى.');
      setState('sent');
      toast('success', 'وصلتنا رسالتك — سنرد عليك عبر بريدك.');
    } catch (err) {
      setState('idle');
      setError((err as Error).message);
      toast('error', (err as Error).message);
    }
  };

  if (state === 'sent') {
    return (
      <div
        data-testid="contact-sent"
        style={{
          background: 'rgba(var(--accent-rgb),.07)', border: '1px solid rgba(var(--accent-rgb),.25)',
          borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <Icon name="check_circle" size={22} color="var(--accent-ink)" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>وصلتنا رسالتك</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>سنرد عليك عبر بريدك خلال يوم عمل.</div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={col}>
          <span style={lbl}>اسمك</span>
          <input name="name" required minLength={2} maxLength={80} style={inp} />
        </label>
        <label style={col}>
          <span style={lbl}>بريدك الإلكتروني</span>
          <input name="email" type="email" required dir="ltr" style={{ ...inp, textAlign: 'left' }} />
        </label>
      </div>
      <label style={col}>
        <span style={lbl}>الموضوع</span>
        <select name="topic" required defaultValue="support" style={inp}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      <label style={col}>
        <span style={lbl}>رسالتك</span>
        <textarea name="messageAr" required minLength={10} maxLength={4000} rows={5} style={{ ...inp, resize: 'vertical' }} />
      </label>
      {error && (
        <p role="alert" style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>
      )}
      <button
        type="submit"
        disabled={state === 'sending'}
        style={{
          alignSelf: 'flex-start', cursor: 'pointer', border: 'none', fontFamily: 'inherit',
          background: 'var(--grad)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 14,
          padding: '12px 26px', borderRadius: 12, opacity: state === 'sending' ? 0.7 : 1,
        }}
      >
        {state === 'sending' ? 'جارٍ الإرسال…' : 'أرسل الرسالة'}
      </button>
    </form>
  );
}

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const lbl: React.CSSProperties = { fontSize: 13, color: 'var(--text-soft)', fontWeight: 600 };
const inp: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 14, color: 'var(--text)', background: 'var(--card)',
  border: '1px solid rgba(var(--ink-rgb),.14)', borderRadius: 12, padding: '11px 14px', outline: 'none',
};
