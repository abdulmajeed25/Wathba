'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { ApiBackingRow } from '@/lib/api/wathba';
import { createCardToken } from '@/lib/payments/moyasar-client';
import { useConfirm, useToast } from './wathba-feedback';
import { Num } from './wathba-icons';
import { AuthorizationRecovery } from './authorization-recovery';

/**
 * Batch PAY — per-pledge actions on «تعهداتي»:
 *  Part 1: cancel with the 48h lock (countdown «يمكنك الإلغاء حتى…», then the
 *          locked chip «قُفلت التعهدات — أقل من ٤٨ ساعة على الإغلاق»).
 *  Part 2: CAPTURE_GRACE card → inline card-update + retry.
 *  Part 4: CAPTURE_GRACE BNPL → complete the hosted checkout.
 */
export function PledgeActions({ row }: { row: ApiBackingRow }) {
  const router = useRouter();
  const toast = useToast();
  const confirmDlg = useConfirm();
  const [busy, setBusy] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' });

  const state = row.state.toUpperCase();
  const graceOpen = row.graceExpiresAt != null && new Date(row.graceExpiresAt).getTime() > Date.now();
  const live = row.projectStatus === 'LIVE' || row.projectStatus === 'PAUSED';
  const cancellable = live && (state === 'HELD' || state === 'PENDING_BNPL');
  const lockAt = row.cancellableUntil ? new Date(row.cancellableUntil) : null;
  const locked = lockAt !== null && lockAt.getTime() <= Date.now();

  const cancel = async (): Promise<void> => {
    if (
      !(await confirmDlg({
        title: 'إلغاء هذا التعهد؟',
        body:
          state === 'PENDING_BNPL'
            ? 'يُلغى طلب التقسيط فوراً — لم يُنشأ أي عقد أو خصم.'
            : 'يُفكّ حجز المبلغ من بطاقتك فوراً ويُخصم تعهدك من عدّاد الحملة.',
        confirmLabel: 'إلغاء التعهد',
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pledges/${row.id}/cancel`, { method: 'POST' });
      if (res.status === 403) {
        toast('error', 'قُفلت التعهدات — أقل من 48 ساعة على إغلاق الحملة.');
      } else if (!res.ok) {
        toast('error', 'تعذّر الإلغاء حالياً — حاول بعد قليل.');
      } else {
        toast('success', 'أُلغي التعهد وأُعيد المبلغ المحجوز.');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const retryCard = async (): Promise<void> => {
    if (busy || row.paymentVerificationPending || !graceOpen) return;
    setBusy(true);
    let submitted = false;
    try {
      const tok = await createCardToken({
        name: card.name,
        number: card.number.replace(/\s+/g, ''),
        month: card.exp.split('/')[0] ?? '',
        year: `20${card.exp.split('/')[1] ?? ''}`,
        cvc: card.cvc,
      });
      if ('error' in tok) throw new Error(tok.error);
      submitted = true;
      const res = await fetch(`/api/pledges/${row.id}/retry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: tok.token }),
      });
      if (!res.ok) throw new Error();
      toast('success', 'تم السحب بنجاح — شكراً لدعمك.');
      setFixOpen(false);
      router.refresh();
    } catch {
      toast('error', submitted ? 'لم تتأكد نتيجة الدفع. نحدّث حالة تعهدك؛ لا تدفع مجددًا قبل التحقق.' : 'تعذر تجهيز البطاقة؛ راجع بياناتها. لم يرسل طلب دفع.');
    } finally {
      if (submitted) { setFixOpen(false); setCard({ name: '', number: '', exp: '', cvc: '' }); router.refresh(); }
      setBusy(false);
    }
  };

  const bnplCheckout = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch(`/api/pledges/${row.id}/bnpl-checkout`, { method: 'POST' });
      const body = (await res.json()) as { url?: string };
      if (!res.ok || !body.url) throw new Error();
      window.location.href = body.url;
    } catch {
      toast('error', 'تعذّر فتح صفحة التقسيط — حاول مجدداً.');
      setBusy(false);
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {state === 'PENDING_AUTH' && row.authorizationRecoverable && <AuthorizationRecovery pledgeId={row.id} />}
      {cancellable && !locked && lockAt && (
        <>
          <Num data-testid="cancel-window" style={{ fontSize: 12, color: 'var(--muted)' }}>
            يمكنك الإلغاء حتى: {lockAt.toLocaleDateString('en-GB')}{' '}
            {lockAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Num>
          <button type="button" onClick={() => void cancel()} disabled={busy} style={ghostDanger}>
            إلغاء التعهد
          </button>
        </>
      )}
      {cancellable && locked && (
        <span data-testid="cancel-locked" style={lockedChip}>
          قُفلت التعهدات — أقل من 48 ساعة على الإغلاق
        </span>
      )}

      {state === 'CAPTURE_GRACE' && row.paymentMethod === 'CARD' && graceOpen && !row.paymentVerificationPending && (
        <div style={{ width: '100%' }}>
          {!fixOpen ? (
            <button type="button" onClick={() => setFixOpen(true)} style={fixBtn}>
              حدّث بطاقتك — تبقّى{' '}
              {row.graceExpiresAt
                ? `${Math.max(0, Math.round((new Date(row.graceExpiresAt).getTime() - Date.now()) / 3_600_000))} ساعة`
                : 'تحتاج الموعد إلى مراجعة'}
            </button>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); void retryCard(); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8, minWidth: 0 }}>
              <input placeholder="رقم البطاقة" dir="ltr" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} style={{ ...miniInput, gridColumn: '1 / -1' }} aria-label="رقم البطاقة" />
              <input placeholder="MM/YY" dir="ltr" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} style={miniInput} aria-label="تاريخ الانتهاء" />
              <input placeholder="CVC" type="password" dir="ltr" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} style={miniInput} aria-label="CVC" />
              <input placeholder="الاسم على البطاقة" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} style={{ ...miniInput, gridColumn: '1 / -1' }} aria-label="الاسم على البطاقة" />
              <button type="submit" disabled={busy} style={{ ...fixBtn, gridColumn: '1 / -1', minHeight: 44 }}>
                {busy ? '…' : 'سحب الآن'}
              </button>
            </form>
          )}
        </div>
      )}

      {state === 'CAPTURE_GRACE' && !graceOpen && <p role="status">انتهت مهلة الدفع؛ نراجع نتيجة التعهد قبل اعتماد فشله أو تحرير المكافأة.</p>}

      {state === 'CAPTURE_GRACE' && row.paymentMethod !== 'CARD' && graceOpen && (
        <button type="button" onClick={() => void bnplCheckout()} disabled={busy} style={fixBtn}>
          أكمل التقسيط مع {row.paymentMethod === 'TABBY' ? 'تابي' : 'تمارا'}
        </button>
      )}
    </div>
  );
}

const ghostDanger: React.CSSProperties = {
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#dc2626',
  background: 'transparent', border: '1px solid rgba(220,38,38,.35)', borderRadius: 10,
  padding: '7px 16px', minHeight: 24,
};
const lockedChip: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--muted)', background: 'rgba(var(--ink-rgb),.05)',
  border: '1px solid rgba(var(--ink-rgb),.14)', borderRadius: 20, padding: '6px 14px',
};
const fixBtn: React.CSSProperties = {
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
  color: 'var(--on-accent)', background: 'var(--grad)', border: 'none', borderRadius: 10,
  padding: '9px 18px', minHeight: 24,
};
const miniInput: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 13, color: 'var(--text)', background: 'var(--card)',
  border: '1px solid rgba(var(--ink-rgb),.14)', borderRadius: 10, padding: '9px 12px', minWidth: 0, width: '100%', boxSizing: 'border-box', minHeight: 44,
};
