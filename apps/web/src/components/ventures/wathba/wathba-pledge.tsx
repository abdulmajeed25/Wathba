'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState, useEffect } from 'react';

import { formatSar } from '@/lib/i18n/format';
import { track } from '@/lib/analytics';

import {
  deriveProject,
  wathbaPledgeSteps,
  wathbaProjects,
  wathbaTiers,
} from './wathba-data';
import { Icon, Num } from './wathba-icons';
import { ShareRow } from './wathba-share';
import { TurnstileSlot } from '@/components/auth/turnstile-slot';
import { createCardToken } from '@/lib/payments/moyasar-client';
import type { ApiRewardTier } from '@/lib/api/wathba';

/**
 * Pledge wizard — 4 steps: tier → info → payment → success.
 * Sticky order summary on the right.
 *
 * Sprint 1 (P0-305/P0-201): when the server passes live tiers, the confirm
 * button tokenizes the card client-side (Moyasar Tokens API — raw card data
 * never touches Wathba, SAQ-A) and POSTs the pledge through /api/pledges.
 * Fixture projects (p1…p8) keep the demo behaviour with no network call.
 */

interface DisplayTier {
  id: string;
  price: number; // SAR
  title: string;
  backers: number;
  desc: string;
  rank: string;
  requiresShipping: boolean;
}

export function WathbaPledge({
  projectId,
  initialTier = 't2',
  liveTiers = null,
  liveTitleAr = null,
  initialAmountSar,
}: {
  projectId: string;
  initialTier?: string;
  liveTiers?: ApiRewardTier[] | null;
  liveTitleAr?: string | null;
  /** Batch PAY (Part 3) — entering via «ادعم بدون مكافأة» (tierless). */
  initialAmountSar?: number;
}) {
  const router = useRouter();
  const project =
    wathbaProjects.find((p) => p.id === projectId) ?? wathbaProjects[0]!;
  const active = deriveProject(project);
  const isLive = Boolean(liveTiers && liveTiers.length > 0);
  const tiers: DisplayTier[] = useMemo(() => {
    if (!isLive) {
      return wathbaTiers.map((t) => ({ ...t, requiresShipping: false }));
    }
    return liveTiers!.map((t) => ({
      id: t.id,
      price: Math.round(t.amountHalalas / 100),
      title: t.titleAr,
      backers: t.claimedQty,
      desc: t.descAr,
      rank: 'داعم مؤسس',
      requiresShipping: t.requiresShipping,
    }));
  }, [isLive, liveTiers]);

  const [step, setStep] = useState(1);

  // STAKES/O1 — funnel: entering the pledge wizard = pledge_started.
  useEffect(() => {
    track('pledge_started', { projectId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tier, setTier] = useState(() =>
    tiers.some((t) => t.id === initialTier) ? initialTier : tiers[0]!.id,
  );

  // Batch PAY (Part 3) — tierless mode + free amount (min 10 SAR).
  const [noReward, setNoReward] = useState(initialAmountSar !== undefined);
  const [freeAmountSar, setFreeAmountSar] = useState(initialAmountSar ?? 25);
  // Batch PAY (Part 4) — payment method (BNPL = deferred-initiation intent).
  const [method, setMethod] = useState<'CARD' | 'TABBY' | 'TAMARA'>('CARD');

  // STAKES/S-15 (A14) — stash the wizard intent (tier + step) per project so
  // a mid-pledge session expiry → re-auth → return lands the user back where
  // they were, not at step 1. Cleared on success; card fields NEVER stashed.
  const stashKey = `wathba_pledge_${projectId}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(stashKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { tier?: string; step?: number };
      if (saved.tier && tiers.some((t) => t.id === saved.tier)) setTier(saved.tier);
      if (saved.step && saved.step >= 1 && saved.step <= 3) setStep(saved.step);
    } catch {
      /* corrupt stash — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (step >= 4) sessionStorage.removeItem(stashKey);
      else sessionStorage.setItem(stashKey, JSON.stringify({ tier, step }));
    } catch {
      /* storage unavailable */
    }
  }, [stashKey, tier, step]);

  // Payment + shipping form state (controlled — Sprint 1).
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [shipName, setShipName] = useState('');
  const [shipAddress, setShipAddress] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipPostal, setShipPostal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const selTier = tiers.find((t) => t.id === tier) ?? tiers[0]!;
  // Batch PAY (Part 3) — tierless pledges: free amount, no shipping fee.
  const effectivePrice = noReward ? Math.max(freeAmountSar, 0) : selTier.price;
  const total = noReward ? effectivePrice : selTier.price + 8; // + shipping

  async function confirmPledge(): Promise<void> {
    if (!isLive) {
      // Demo fixture — keep the original in-page success step.
      setStep(4);
      return;
    }
    setPayError(null);
    // Batch PAY (Part 3) — server also enforces the 10 SAR minimum.
    if (noReward && total < 10) {
      setPayError('الحد الأدنى للدعم ١٠ ريالات.');
      return;
    }
    const [expMonth = '', expYear = ''] = cardExp.split('/').map((s) => s.trim());
    // Batch PAY (Part 4) — BNPL needs no card details (hosted checkout later,
    // and only if the campaign succeeds).
    if (method === 'CARD' && (!cardName || cardNumber.replace(/\D/g, '').length < 12 || !expMonth || !expYear || cardCvc.length < 3)) {
      setPayError('أكمل بيانات البطاقة (الاسم، الرقم، تاريخ الانتهاء MM/YY، CVC).');
      return;
    }
    if (!noReward && selTier.requiresShipping && (!shipName || !shipAddress || !shipCity || !/^\d{4,10}$/.test(shipPostal))) {
      setPayError('هذا المستوى يتطلب عنوان شحن كامل (الاسم، العنوان، المدينة، رمز بريدي 4–10 أرقام).');
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      let source = 'bnpl-intent';
      if (method === 'CARD') {
        const tok = await createCardToken({
          name: cardName,
          number: cardNumber,
          month: expMonth,
          year: expYear,
          cvc: cardCvc,
        });
        if ('error' in tok) {
          setPayError(tok.error);
          return;
        }
        source = tok.token;
      }
      const res = await fetch('/api/pledges', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(localStorage.getItem('wathba_ref') ? { 'x-wathba-ref': localStorage.getItem('wathba_ref')! } : {}) },
        body: JSON.stringify({
          projectId,
          // STAKES/S-14 P3 — Turnstile implicit field (absent when the slot is off).
          ...(typeof document !== 'undefined' && (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value
            ? { captchaToken: (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement).value }
            : {}),
          ...(noReward ? {} : { tierId: selTier.id }),
          amountHalalas: Math.round(total * 100),
          source,
          paymentMethod: method,
          ...(!noReward && selTier.requiresShipping
            ? {
                shipping: {
                  name: shipName,
                  address: shipAddress,
                  city: shipCity,
                  country: 'SA',
                  postal: shipPostal,
                },
              }
            : {}),
        }),
      });
      const json = (await res.json()) as { paymentRef?: string; message?: string | string[] };
      if (!res.ok) {
        const msg = Array.isArray(json.message) ? json.message.join('، ') : json.message;
        setPayError(msg ?? 'تعذّر إتمام الدفع');
        return;
      }
      router.push(
        `/projects/${projectId}/back/success${json.paymentRef ? `?ref=${encodeURIComponent(json.paymentRef)}` : ''}`,
      );
    } catch {
      setPayError('خطأ في الاتصال — أعد المحاولة.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wathba-fade">
      {/* ───────── header + stepper ───────── */}
      <section
        style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 26px 0' }}
      >
        <Link
          href={`/projects/${active.id}`}
          style={{
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 20,
            textDecoration: 'none',
          }}
        >
          <Icon name="arrow_forward" size={17} />
          عودة للمشروع
        </Link>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          ادعم: {liveTitleAr ?? active.titleAr}
        </h1>
        <p
          style={{
            fontSize: 14.5,
            color: 'var(--muted)',
            marginBottom: 30,
          }}
        >
          دعمك مؤمَّن — لن يُخصم أي مبلغ إلا عند نجاح المشروع.
        </p>

        {/* §5 mandatory threshold disclosure — must be visible BEFORE pledge */}
        {active.releaseThresholdPct && active.releaseThresholdPct < 100 && (
          <div
            style={{
              marginBottom: 26,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: 'rgba(var(--accent-rgb),.06)',
              border: '1px solid rgba(var(--accent-rgb),.22)',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <Icon name="info" size={20} color="var(--accent)" />
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-soft)' }}>
              <strong>قاعدة عتبة الإطلاق:</strong>{' '}
              يُطلق المشروع عند بلوغ{' '}
              <Num style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>
                {formatSar('ar', Math.round((active.goal * active.releaseThresholdPct) / 100))}
              </Num>{' '}
              ({active.releaseThresholdPct}% من الهدف). إذا لم يبلغ ذلك بحلول الموعد
              النهائي، يُعاد كامل دعمك تلقائياً إلى بطاقتك خلال أيام عمل قليلة.
            </div>
          </div>
        )}

        {/* stepper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 36,
          }}
        >
          {wathbaPledgeSteps.map((s, i) => {
            const reached = step >= s.n;
            const isLast = i === wathbaPledgeSteps.length - 1;
            return (
              <div
                key={s.n}
                style={{ display: 'flex', alignItems: 'center', flex: 1 }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <Num
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: reached
                        ? 'var(--grad)'
                        : 'rgba(var(--ink-rgb),.06)',
                      color: reached ? 'var(--on-accent)' : 'var(--muted2)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                      transition: 'all .3s',
                    }}
                  >
                    {s.n}
                  </Num>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: reached ? 'var(--text)' : 'var(--muted2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {!isLast && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: 'rgba(var(--ink-rgb),.1)',
                      margin: '0 14px',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────── step body + order summary ───────── */}
      <section
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          padding: '0 26px 10px',
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr',
          gap: 28,
          alignItems: 'start',
        }}
      >
        <div>
          {/* STEP 1 — choose tier */}
          {step === 1 && (
            <div className="wathba-fade">
              <h2
                style={{ fontSize: 21, fontWeight: 700, marginBottom: 16 }}
              >
                اختر مستوى الدعم
              </h2>
              {/* Batch PAY (Part 3) — first-class tierless support card. */}
              <div
                data-testid="no-reward-card"
                onClick={() => setNoReward(true)}
                style={{
                  cursor: 'pointer', borderRadius: 13, padding: 15, marginBottom: 11,
                  border: noReward ? '1.5px solid var(--accent)' : '1px dashed rgba(var(--accent-rgb),.4)',
                  background: noReward ? 'rgba(var(--accent-rgb),.06)' : 'var(--card)',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>ادعم بدون مكافأة ❤</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: noReward ? 10 : 0 }}>
                  أي مبلغ من ١٠ ريالات — كل داعم يُحتسب مهما كان مبلغه.
                </div>
                {noReward && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {[10, 25, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFreeAmountSar(amt); }}
                        style={{
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                          padding: '6px 14px', minHeight: 24, borderRadius: 999,
                          border: freeAmountSar === amt ? '1.5px solid var(--accent)' : '1px solid rgba(var(--ink-rgb),.16)',
                          background: freeAmountSar === amt ? 'rgba(var(--accent-rgb),.1)' : 'transparent',
                          color: freeAmountSar === amt ? 'var(--accent-ink)' : 'var(--text-soft)',
                        }}
                      >
                        {amt} ر.س
                      </button>
                    ))}
                    <input
                      type="number"
                      min={10}
                      value={freeAmountSar}
                      aria-label="مبلغ الدعم"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setFreeAmountSar(Number(e.target.value))}
                      style={{
                        width: 110, fontFamily: 'inherit', fontSize: 13, padding: '7px 10px',
                        border: '1px solid rgba(var(--ink-rgb),.16)', borderRadius: 10,
                        background: 'var(--card)', color: 'var(--text)', outline: 'none',
                      }}
                    />
                    {freeAmountSar < 10 && (
                      <span role="alert" style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                        الحد الأدنى للدعم ١٠ ريالات
                      </span>
                    )}
                  </div>
                )}
              </div>
              {tiers.map((t) => {
                const selected = tier === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => { setTier(t.id); setNoReward(false); }}
                    style={{
                      cursor: 'pointer',
                      background: selected
                        ? 'rgba(var(--accent-rgb),.06)'
                        : 'var(--card)',
                      border: `1.5px solid ${
                        selected
                          ? 'var(--accent)'
                          : 'rgba(var(--ink-rgb),.09)'
                      }`,
                      borderRadius: 16,
                      padding: '18px 20px',
                      marginBottom: 13,
                      transition: 'all .25s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 7,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Num
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: 'var(--accent-ink)',
                          }}
                        >
                          {formatSar('ar', t.price)}
                        </Num>
                        <h4 style={{ fontSize: 16, fontWeight: 700 }}>
                          {t.title}
                        </h4>
                      </div>
                      <Num style={{ fontSize: 12, color: 'var(--muted2)' }}>
                        {t.backers} داعم
                      </Num>
                    </div>
                    <p
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: 'var(--muted)',
                      }}
                    >
                      {t.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 2 — shipping + contact */}
          {step === 2 && (
            <div className="wathba-fade">
              <h2
                style={{ fontSize: 21, fontWeight: 700, marginBottom: 18 }}
              >
                معلومات الشحن والتواصل
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <PledgeField
                  label="الاسم الكامل"
                  placeholder="مثال: سارة العامري"
                  value={shipName}
                  onChange={setShipName}
                />
                <PledgeField
                  label="البريد الإلكتروني"
                  placeholder="you@email.com"
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <PledgeField
                  label="العنوان"
                  placeholder="الشارع، المبنى، الشقة"
                  value={shipAddress}
                  onChange={setShipAddress}
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 14,
                }}
              >
                <PledgeField label="المدينة" value={shipCity} onChange={setShipCity} />
                <PledgeField label="الدولة" defaultValue="السعودية" />
                <PledgeField
                  label="الرمز البريدي"
                  value={shipPostal}
                  onChange={setShipPostal}
                  mono
                />
              </div>
            </div>
          )}

          {/* STEP 3 — payment */}
          {step === 3 && (
            <div className="wathba-fade">
              <h2
                style={{ fontSize: 21, fontWeight: 700, marginBottom: 18 }}
              >
                طريقة الدفع
              </h2>
              {/* Batch PAY (Part 4) — method selector: card vs BNPL intents. */}
              <div role="radiogroup" aria-label="طريقة الدفع" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {([['CARD', 'بطاقة'], ['TABBY', 'قسّطها مع تابي'], ['TAMARA', 'قسّطها مع تمارا']] as const).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    style={{
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                      padding: '9px 18px', minHeight: 24, borderRadius: 11,
                      border: method === m ? '1.5px solid var(--accent)' : '1px solid rgba(var(--ink-rgb),.16)',
                      background: method === m ? 'rgba(var(--accent-rgb),.08)' : 'transparent',
                      color: method === m ? 'var(--accent-ink)' : 'var(--text-soft)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {method !== 'CARD' && (
                <div
                  data-testid="bnpl-disclosure"
                  style={{
                    fontSize: 13, lineHeight: 1.8, color: 'var(--text-soft)', marginBottom: 18,
                    background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.25)',
                    borderRadius: 12, padding: '12px 16px',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    ٤ دفعات × {Math.ceil((total || 0) / 4)} ر.س عبر {method === 'TABBY' ? 'تابي' : 'تمارا'}
                  </div>
                  لن يُنشأ التقسيط إلا إذا نجحت الحملة — لا عقد ولا خصم قبل ذلك،
                  وإن لم تبلغ الحملة هدفها يُلغى الطلب تلقائياً دون أي أثر.
                </div>
              )}
              <div style={{ display: method === 'CARD' ? 'flex' : 'none', gap: 11, marginBottom: 20 }}>
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(var(--accent-rgb),.06)',
                    border: '1.5px solid var(--accent)',
                    borderRadius: 13,
                    padding: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="credit_card" size={22} color="var(--accent)" />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    بطاقة ائتمان
                  </span>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(var(--ink-rgb),.03)',
                    border: '1px solid rgba(var(--ink-rgb),.1)',
                    borderRadius: 13,
                    padding: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <Icon
                    name="account_balance_wallet"
                    size={22}
                    color="var(--muted)"
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--muted)',
                    }}
                  >
                    محفظة رقمية
                  </span>
                </div>
              </div>
              {/* Batch PAY (Part 4) — card fields hide for BNPL (hosted flow). */}
              <div style={{ display: method === 'CARD' ? 'block' : 'none' }}>
              <div style={{ marginBottom: 14 }}>
                <label
                  htmlFor="wathba-card-number"
                  style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    display: 'block',
                    marginBottom: 7,
                  }}
                >
                  رقم البطاقة
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(var(--ink-rgb),.04)',
                    border: '1px solid rgba(var(--ink-rgb),.12)',
                    borderRadius: 11,
                    padding: '0 14px',
                  }}
                >
                  <input
                    id="wathba-card-number"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4111 1111 1111 1111"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    aria-label="رقم البطاقة"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      padding: '12px 0',
                      color: 'var(--text)',
                      fontSize: 14,
                      fontFamily: '"Space Grotesk", sans-serif',
                    }}
                  />
                  <Icon name="lock" size={20} color="var(--accent)" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <PledgeField
                  label="الاسم على البطاقة"
                  placeholder="SARA ALAMRI"
                  value={cardName}
                  onChange={setCardName}
                  mono
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                }}
              >
                <PledgeField
                  label="تاريخ الانتهاء"
                  placeholder="MM/YY"
                  value={cardExp}
                  onChange={setCardExp}
                  mono
                />
                <PledgeField
                  label="CVC"
                  placeholder="123"
                  value={cardCvc}
                  onChange={setCardCvc}
                  mono
                />
              </div>
              {payError && (
                <div
                  role="alert"
                  style={{
                    marginTop: 16,
                    fontSize: 13,
                    color: '#ef4444',
                    background: 'rgba(239,68,68,.07)',
                    border: '1px solid rgba(239,68,68,.25)',
                    borderRadius: 11,
                    padding: '12px 14px',
                  }}
                >
                  {payError}
                </div>
              )}
              </div>
              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  fontSize: 12.5,
                  color: 'var(--pos-ink)',
                  background: 'rgba(52,211,153,.06)',
                  border: '1px solid rgba(52,211,153,.18)',
                  borderRadius: 11,
                  padding: '12px 14px',
                }}
              >
                <Icon name="shield" size={18} />
                الدفع مشفّر بالكامل. لن يُخصم المبلغ إلا عند نجاح المشروع.
              </div>
              <div style={{ marginTop: 10 }}>
                <TurnstileSlot />
              </div>
            </div>
          )}

          {/* STEP 4 — success */}
          {step === 4 && (
            <div
              className="wathba-fade"
              style={{ textAlign: 'center', padding: '24px 0' }}
            >
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: 'var(--grad)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 24px',
                  boxShadow: '0 0 50px -10px rgba(var(--accent-rgb),.6)',
                  animation: 'wathba-pulsering 2.5s infinite',
                }}
              >
                <Icon name="check" size={48} fill color="var(--on-accent)" />
              </div>
              <h2
                style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}
              >
                شكراً لدعمك! 🎉
              </h2>
              <p
                style={{
                  fontSize: 16,
                  color: 'var(--text-soft)',
                  maxWidth: 440,
                  margin: '0 auto 22px',
                }}
              >
                أصبحت الآن داعماً لـ«{liveTitleAr ?? active.titleAr}». سنوافيك بكل التحديثات
                على بريدك.
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(251,191,36,.1)',
                  border: '1px solid rgba(251,191,36,.3)',
                  borderRadius: 14,
                  padding: '14px 22px',
                  marginBottom: 28,
                }}
              >
                <Icon
                  name="workspace_premium"
                  size={26}
                  fill
                  color="var(--gold)"
                />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    ارتقت رتبتك إلى
                  </div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: 'var(--gold-ink)',
                    }}
                  >
                    {selTier.rank}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                <Link
                  href="/projects/me/profile"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--grad)',
                    color: 'var(--on-accent)',
                    fontWeight: 700,
                    fontSize: 15,
                    padding: '13px 24px',
                    borderRadius: 13,
                    textDecoration: 'none',
                  }}
                >
                  ملفي الشخصي
                </Link>
                <Link
                  href="/projects/discover-all"
                  style={{
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid rgba(var(--ink-rgb),.16)',
                    color: 'var(--text)',
                    fontWeight: 600,
                    fontSize: 15,
                    padding: '13px 24px',
                    borderRadius: 13,
                    textDecoration: 'none',
                  }}
                >
                  اكتشف المزيد
                </Link>
              </div>
              {/* STAKES/S-10 F-04 (I3) — share the pledge at the peak moment. */}
              <div style={{ marginTop: 28 }}>
                <ShareRow
                  title={liveTitleAr ?? active.titleAr}
                  url={`/projects/${projectId}`}
                />
              </div>
            </div>
          )}

          {/* nav buttons (hidden on success) */}
          {step < 4 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  style={{
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid rgba(var(--ink-rgb),.16)',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    fontSize: 15,
                    padding: '14px 24px',
                    borderRadius: 13,
                    fontFamily: 'inherit',
                  }}
                >
                  رجوع
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  if (step === 3) void confirmPledge();
                  else setStep((s) => Math.min(4, s + 1));
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  background: 'var(--grad)',
                  color: 'var(--on-accent)',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: 14,
                  borderRadius: 13,
                  fontFamily: 'inherit',
                }}
              >
                {step === 3 ? (submitting ? 'جارٍ تأكيد الدعم…' : 'تأكيد الدعم') : 'متابعة'}
              </button>
            </div>
          )}
        </div>

        {/* ───────── order summary ───────── */}
        <div
          style={{
            position: 'sticky',
            top: 90,
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.09)',
            borderRadius: 18,
            padding: 22,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            ملخص الدعم
          </div>
          <div
            className="wathba-ph"
            style={{
              height: 120,
              borderRadius: 13,
              marginBottom: 16,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Num style={{ fontSize: 11, color: 'var(--ph-label)' }}>
                [ {active.cat} ]
              </Num>
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {liveTitleAr ?? active.titleAr}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--muted2)',
              marginBottom: 18,
            }}
          >
            بواسطة {active.creator}
          </div>
          <div
            style={{
              borderTop: '1px solid rgba(var(--ink-rgb),.08)',
              paddingTop: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                marginBottom: 11,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>{selTier.title}</span>
              <Num style={{ fontWeight: 600 }}>
                {formatSar('ar', selTier.price)}
              </Num>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                marginBottom: 11,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>الشحن</span>
              <Num style={{ fontWeight: 600 }}>8 ر.س</Num>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 18,
                fontWeight: 700,
                borderTop: '1px solid rgba(var(--ink-rgb),.08)',
                paddingTop: 14,
                marginTop: 4,
              }}
            >
              <span>الإجمالي</span>
              <Num style={{ color: 'var(--accent-ink)' }}>
                {formatSar('ar', total)}
              </Num>
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11.5,
              color: 'var(--muted2)',
              background: 'rgba(251,191,36,.06)',
              border: '1px solid rgba(251,191,36,.18)',
              borderRadius: 11,
              padding: '10px 12px',
            }}
          >
            <Icon name="workspace_premium" size={16} color="var(--gold)" />
            هذا الدعم يمنحك رتبة «{selTier.rank}»
          </div>
        </div>
      </section>
    </div>
  );
}

function PledgeField({
  label,
  placeholder,
  defaultValue,
  value,
  onChange,
  mono = false,
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          display: 'block',
          marginBottom: 7,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        aria-label={label}
        placeholder={placeholder}
        defaultValue={defaultValue}
        {...(onChange
          ? { value: value ?? '', onChange: (e) => onChange(e.target.value) }
          : {})}
        style={{
          width: '100%',
          background: 'rgba(var(--ink-rgb),.04)',
          border: '1px solid rgba(var(--ink-rgb),.12)',
          borderRadius: 11,
          padding: '12px 14px',
          color: 'var(--text)',
          fontSize: 14,
          fontFamily: mono ? '"Space Grotesk", sans-serif' : 'inherit',
        }}
      />
    </div>
  );
}
