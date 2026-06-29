'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { ApiBidPublic, ApiRfqPublic } from '@/lib/api/wathba';
import { type SupplierBidInput, supplierBidSchema } from '@/lib/validators';
import {
  type WathbaRfq,
  type WathbaSupplierBid,
  wathbaMySupplierBids,
  wathbaRfqs,
} from './wathba-data';
import { Icon, Num } from './wathba-icons';

/**
 * §10 reverse-supplier-auction portal — suppliers see open RFQs creators
 * have published, submit bids (amount + lead time + spec-compliance %), and
 * track their own bid status (PENDING/AWARDED/REJECTED).
 *
 * This is a pure UI surface today — wires to apps/api `/v1/rfqs` and
 * `/v1/rfqs/:id/bids` once the supplier identity story lands.
 */

type TabId = 'rfqs' | 'bids' | 'submit';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'rfqs',   label: 'الطلبات المفتوحة', icon: 'inbox' },
  { id: 'bids',   label: 'عروضي',             icon: 'gavel' },
  { id: 'submit', label: 'تقديم عرض',         icon: 'send' },
];

const STATUS_TONE: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:     { label: 'مفتوح',  color: 'var(--pos)',    bg: 'rgba(52,211,153,.10)' },
  AWARDED:  { label: 'مُرسى',   color: 'var(--accent)', bg: 'rgba(var(--accent-rgb),.10)' },
  CLOSED:   { label: 'مغلق',   color: 'var(--muted)',  bg: 'rgba(var(--ink-rgb),.06)' },
  PENDING:  { label: 'قيد التقييم', color: 'var(--gold)',   bg: 'rgba(251,191,36,.10)' },
  REJECTED: { label: 'مرفوض',    color: 'var(--muted)',  bg: 'rgba(var(--ink-rgb),.06)' },
};

export function WathbaSupplier({
  liveRfqs,
  liveMyBids,
}: {
  liveRfqs?: ApiRfqPublic[] | null;
  liveMyBids?: ApiBidPublic[] | null;
} = {}) {
  // Live data with bundled-fixture fallback (DB empty / API unreachable).
  const rfqs: WathbaRfq[] =
    liveRfqs && liveRfqs.length > 0
      ? liveRfqs.map((r) => ({
          id: r.id,
          ventureTitleAr: r.ventureTitleAr,
          ventureSlug: r.ventureSlug,
          specsAr: r.specsAr,
          dueDate: r.dueDate.slice(0, 10),
          bidsCount: r.bidsCount,
          status: r.status,
          category: r.category,
        }))
      : wathbaRfqs;

  const myBids: WathbaSupplierBid[] =
    liveMyBids && liveMyBids.length > 0
      ? liveMyBids.map((b) => ({
          id: b.id,
          rfqId: b.rfqId,
          rfqTitleAr: b.rfqTitleAr,
          amount: Math.round(b.amountHalalas / 100),
          leadTimeDays: b.leadTimeDays,
          status: b.status,
          submittedAt: b.submittedAt.slice(0, 10),
        }))
      : wathbaMySupplierBids;

  const isLive = Boolean(
    (liveRfqs && liveRfqs.length > 0) || (liveMyBids && liveMyBids.length > 0),
  );

  const [tab, setTab] = useState<TabId>('rfqs');
  const [selRfq, setSelRfq] = useState<string>(rfqs[0]?.id ?? '');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="wathba-fade">
      {/* hero */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '48px 26px 0' }}>
        <Num style={{ fontSize: 12, letterSpacing: 2, color: 'var(--accent)', display: 'block', marginBottom: 8 }}>
          SUPPLIER PORTAL · بوابة الموردين
        </Num>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 8 }}>
          المزاد العكسي للموردين
        </h1>
        {isLive && (
          <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--pos)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="verified" size={13} color="var(--pos)" /> بيانات مباشرة من API
          </div>
        )}
        <p style={{ fontSize: 16, color: 'var(--text-soft)', maxWidth: 720, lineHeight: 1.6 }}>
          صناعيّون من المنطقة يقدّمون عروضاً تنافسية لتلبية طلبات المبدعين. اختر طلباً مفتوحاً،
          قدّم عرضك (السعر، مهلة التسليم، التزام المواصفات)، وستقوم خوارزمية وثبة بترتيب العروض
          آلياً مع كلمة المبدع الأخيرة في الإرساء.
        </p>
      </section>

      {/* tab bar */}
      <section
        style={{
          maxWidth: 1160,
          margin: '30px auto 0',
          padding: '0 26px',
          borderBottom: '1px solid rgba(var(--ink-rgb),.08)',
        }}
      >
        <div style={{ display: 'flex', gap: 26 }}>
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  cursor: 'pointer',
                  padding: '14px 2px',
                  borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 15,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: 'none',
                  borderBottomWidth: 2,
                  borderBottomStyle: 'solid',
                  fontFamily: 'inherit',
                }}
              >
                <Icon name={t.icon} size={19} />
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* body */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '30px 26px 80px' }}>
        {tab === 'rfqs' && <RfqList rfqs={rfqs} onApply={(id) => { setSelRfq(id); setTab('submit'); }} />}
        {tab === 'bids' && <BidList bids={myBids} />}
        {tab === 'submit' && (
          <SubmitForm
            rfqs={rfqs.filter((r) => r.status === 'OPEN')}
            initialRfqId={selRfq}
            onSubmitted={() => {
              setSubmitted(true);
              setTimeout(() => setSubmitted(false), 4000);
            }}
            submitted={submitted}
          />
        )}
      </section>
    </div>
  );
}

function RfqList({ rfqs, onApply }: { rfqs: WathbaRfq[]; onApply: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))' }}>
      {rfqs.map((r) => {
        const tone = STATUS_TONE[r.status]!;
        return (
          <div
            key={r.id}
            style={{
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 18,
              padding: 22,
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Icon name="category" size={16} color="var(--accent)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{r.category}</span>
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: '3px 11px',
                  borderRadius: 20,
                  background: tone.bg,
                  color: tone.color,
                }}
              >
                {tone.label}
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700 }}>{r.ventureTitleAr}</h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--muted)' }}>{r.specsAr}</p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--muted2)',
                borderTop: '1px solid rgba(var(--ink-rgb),.06)',
                paddingTop: 12,
              }}
            >
              <Num>الاستحقاق: {r.dueDate}</Num>
              <Num>{r.bidsCount} عروض</Num>
            </div>
            {r.status === 'OPEN' && (
              <button
                type="button"
                onClick={() => onApply(r.id)}
                style={{
                  marginTop: 4,
                  background: 'var(--grad)',
                  color: 'var(--on-accent)',
                  border: 'none',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 14,
                  padding: '12px 16px',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                قدّم عرضي
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BidList({ bids }: { bids: WathbaSupplierBid[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {bids.map((b) => {
        const tone = STATUS_TONE[b.status]!;
        return (
          <div
            key={b.id}
            style={{
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 16,
              padding: 18,
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <h4 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>{b.rfqTitleAr}</h4>
              <Num style={{ fontSize: 12, color: 'var(--muted2)', display: 'block' }}>
                {b.submittedAt}
              </Num>
            </div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted2)' }}>السعر</div>
                <Num style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                  ${b.amount.toLocaleString('en-US')}
                </Num>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted2)' }}>المهلة</div>
                <Num style={{ fontSize: 16, fontWeight: 700 }}>
                  {b.leadTimeDays} يوم
                </Num>
              </div>
              <span
                style={{
                  alignSelf: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: tone.bg,
                  color: tone.color,
                }}
              >
                {tone.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubmitForm({
  rfqs,
  initialRfqId,
  onSubmitted,
  submitted,
}: {
  rfqs: WathbaRfq[];
  initialRfqId: string;
  onSubmitted: () => void;
  submitted: boolean;
}) {
  // react-hook-form + zod: schema-driven validation with inline Arabic error
  // messages. The current submit handler is a no-op stub (UI confirmation
  // only) pending SUPPLIER-role web auth, but the form data is already
  // validated and shaped per `SupplierBidInput`.
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SupplierBidInput>({
    resolver: zodResolver(supplierBidSchema),
    defaultValues: {
      rfqId: initialRfqId || rfqs[0]?.id || '',
      amount: 0,
      leadTimeDays: 0,
      compliancePct: 0,
    },
    mode: 'onBlur',
  });
  const selectedId = watch('rfqId');
  const selected = rfqs.find((r) => r.id === selectedId);

  const onSubmit = handleSubmit(async (_data) => {
    // TODO: when SUPPLIER-role auth lands, POST to `/v1/rfqs/${rfqId}/bids`.
    // Today this remains a UI-only confirmation so the screen can be reviewed.
    await new Promise((r) => setTimeout(r, 300));
    reset();
    onSubmitted();
  });

  if (submitted) {
    return (
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(52,211,153,.32)',
          borderRadius: 18,
          padding: 36,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--grad)', color: 'var(--on-accent)',
            display: 'grid', placeItems: 'center',
            margin: '0 auto 14px',
          }}
        >
          <Icon name="check_circle" size={32} fill color="var(--on-accent)" />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>تم استلام عرضك</h3>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          سيُقيَّم عرضك آلياً ثم يرى المبدع الترتيب النهائي. ستصلك إشعار البريد عند الإرساء.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 18,
        padding: 26,
        maxWidth: 720,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>تقديم عرض جديد</h2>
      <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>
        كل الحقول إلزامية. السعر بالريال، مهلة التسليم بالأيام، نسبة الالتزام بالمواصفات
        من 0% إلى 100%.
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>الطلب</span>
        <select {...register('rfqId')} style={inputStyle}>
          {rfqs.map((r) => (
            <option key={r.id} value={r.id}>{r.ventureTitleAr} — {r.category}</option>
          ))}
        </select>
        {errors.rfqId && <FieldErr msg={errors.rfqId.message!} />}
        {selected && (
          <span style={{ fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.55, marginTop: 4 }}>
            {selected.specsAr}
          </span>
        )}
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>السعر (ر.س)</span>
          <input
            type="number" min={1} placeholder="25000"
            {...register('amount')}
            style={inputStyle}
          />
          {errors.amount && <FieldErr msg={errors.amount.message!} />}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>المهلة (يوم)</span>
          <input
            type="number" min={1} max={365} placeholder="21"
            {...register('leadTimeDays')}
            style={inputStyle}
          />
          {errors.leadTimeDays && <FieldErr msg={errors.leadTimeDays.message!} />}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>الالتزام (%)</span>
          <input
            type="number" min={0} max={100} placeholder="95"
            {...register('compliancePct')}
            style={inputStyle}
          />
          {errors.compliancePct && <FieldErr msg={errors.compliancePct.message!} />}
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          background: 'var(--grad)',
          color: 'var(--on-accent)',
          border: 'none',
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: 16,
          padding: 15,
          borderRadius: 14,
          cursor: isSubmitting ? 'progress' : 'pointer',
          opacity: isSubmitting ? 0.7 : 1,
          display: 'inline-flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="send" size={20} color="var(--on-accent)" />
        {isSubmitting ? 'جاري الإرسال…' : 'أرسل العرض'}
      </button>
    </form>
  );
}

function FieldErr({ msg }: { msg: string }) {
  return (
    <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{msg}</span>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(var(--ink-rgb),.04)',
  border: '1px solid rgba(var(--ink-rgb),.12)',
  borderRadius: 11,
  padding: '12px 14px',
  fontSize: 15,
  color: 'var(--text)',
  fontFamily: 'inherit',
};
