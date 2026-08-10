'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { ApiBeneficiary } from '@/lib/api/wathba';

/**
 * Creator payout beneficiary form (Sprint 5 / #7). Bank IBAN (or wallet
 * mobile) captured here becomes the Moyasar `destination` for payouts. A
 * creator cannot be paid until this is on file — surfaced at the top of the
 * payouts/escrow screen.
 */
export function WathbaBeneficiaryForm({ current }: { current: ApiBeneficiary | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(current === null);
  const [type, setType] = useState<'BANK_ACCOUNT' | 'WALLET'>(current?.type ?? 'BANK_ACCOUNT');
  const [iban, setIban] = useState('');
  const [name, setName] = useState(current?.name ?? '');
  const [mobile, setMobile] = useState(current?.mobile ?? '');
  const [city, setCity] = useState(current?.city ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setError(null);
    if (name.trim().length < 2 || !/^\+?\d{9,15}$/.test(mobile)) {
      setError('أدخل الاسم كاملاً ورقم جوال صحيح (٩–١٥ رقماً).');
      return;
    }
    if (type === 'BANK_ACCOUNT' && iban.replace(/\s/g, '').length < 15) {
      setError('أدخل رقم آيبان صحيح.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/payouts/beneficiary', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type,
          ...(type === 'BANK_ACCOUNT' ? { iban: iban.replace(/\s/g, '') } : {}),
          name: name.trim(),
          mobile,
          ...(city.trim() ? { city: city.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string | string[] };
        setError(Array.isArray(j.message) ? j.message.join('، ') : (j.message ?? 'تعذّر الحفظ'));
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('خطأ في الاتصال — أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  }

  const box: React.CSSProperties = {
    background: 'var(--card)',
    border: `1px solid ${current ? 'rgba(var(--ink-rgb),.08)' : 'rgba(251,191,36,.4)'}`,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  };
  const input: React.CSSProperties = {
    width: '100%',
    marginTop: 6,
    background: 'rgba(var(--ink-rgb),.04)',
    border: '1px solid rgba(var(--ink-rgb),.12)',
    borderRadius: 11,
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'inherit',
  };

  if (!editing && current) {
    return (
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>حساب استلام الدفعات</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {current.type === 'BANK_ACCOUNT' ? `آيبان: ${current.ibanMasked}` : `محفظة: ${current.mobile}`} · {current.name}
            </div>
            <div style={{ fontSize: 11.5, color: current.registered ? 'var(--pos-ink)' : 'var(--gold-ink)', marginTop: 4 }}>
              {current.registered ? '✓ جاهز لاستلام الدفعات' : 'بانتظار التحقق قبل أول دفعة'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              cursor: 'pointer', background: 'transparent', border: '1px solid rgba(var(--ink-rgb),.16)',
              color: 'var(--text)', fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit',
            }}
          >
            تعديل
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        {current ? 'تعديل حساب استلام الدفعات' : 'أضف حساب استلام الدفعات'}
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
        لا يمكن تحويل دفعات مشروعك دون بيانات بنكية. تُستخدم هذه البيانات فقط لتحويل مستحقاتك عبر
        بوّابة الدفع المرخّصة.
      </p>
      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--err)', marginBottom: 12 }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {(['BANK_ACCOUNT', 'WALLET'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            style={{
              cursor: 'pointer', flex: 1, padding: '9px 12px', borderRadius: 10, fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
              background: type === t ? 'rgba(var(--accent-rgb),.08)' : 'transparent',
              border: `1.5px solid ${type === t ? 'var(--accent)' : 'rgba(var(--ink-rgb),.14)'}`,
              color: type === t ? 'var(--accent-ink)' : 'var(--muted)',
            }}
          >
            {t === 'BANK_ACCOUNT' ? 'حساب بنكي (آيبان)' : 'محفظة رقمية'}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {type === 'BANK_ACCOUNT' && (
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>
            رقم الآيبان (IBAN)
            <input
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="SA0000000000000000000000"
              style={{ ...input, fontFamily: '"Space Grotesk", monospace' }}
              aria-label="رقم الآيبان"
            />
          </label>
        )}
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>
          اسم صاحب الحساب
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} aria-label="اسم صاحب الحساب" />
        </label>
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>
          رقم الجوال
          <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+9665XXXXXXXX" style={input} aria-label="رقم الجوال" />
        </label>
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>
          المدينة (اختياري)
          <input value={city} onChange={(e) => setCity(e.target.value)} style={input} aria-label="المدينة" />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          style={{
            cursor: busy ? 'wait' : 'pointer', background: 'var(--grad)', color: 'var(--on-accent)', border: 'none',
            fontWeight: 700, fontSize: 14, padding: '11px 22px', borderRadius: 11, fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'جارٍ الحفظ…' : 'حفظ بيانات الحساب'}
        </button>
        {current && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(false)}
            style={{
              cursor: 'pointer', background: 'transparent', border: '1px solid rgba(var(--ink-rgb),.15)',
              color: 'var(--muted)', fontWeight: 600, fontSize: 14, padding: '11px 22px', borderRadius: 11, fontFamily: 'inherit',
            }}
          >
            إلغاء
          </button>
        )}
      </div>
    </div>
  );
}
