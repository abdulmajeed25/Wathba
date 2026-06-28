'use client';

import { useState } from 'react';

import type { ApiBidPublic, ApiRfqPublic } from '@/lib/api/wathba';
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
  const [amount, setAmount] = useState('');
  const [lead, setLead] = useState('');
  const [compliance, setCompliance] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: when SUPPLIER-role auth lands, POST to `/v1/rfqs/${selRfq}/bids`
    // with the bearer cookie. Today this remains a UI-only confirmation so
    // the screen can be reviewed.
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setAmount(''); setLead(''); setCompliance('');
  };

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
            selRfq={selRfq}
            setSelRfq={setSelRfq}
            amount={amount}
            setAmount={setAmount}
            lead={lead}
            setLead={setLead}
            compliance={compliance}
            setCompliance={setCompliance}
            onSubmit={handleSubmit}
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
  selRfq,
  setSelRfq,
  amount,
  setAmount,
  lead,
  setLead,
  compliance,
  setCompliance,
  onSubmit,
  submitted,
}: {
  rfqs: WathbaRfq[];
  selRfq: string;
  setSelRfq: (s: string) => void;
  amount: string;
  setAmount: (s: string) => void;
  lead: string;
  setLead: (s: string) => void;
  compliance: string;
  setCompliance: (s: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitted: boolean;
}) {
  const selected = rfqs.find((r) => r.id === selRfq);

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
        كل الحقول إلزامية. السعر بالدولار، مهلة التسليم بالأيام، نسبة الالتزام بالمواصفات
        من 0% إلى 100%.
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>الطلب</span>
        <select
          value={selRfq}
          onChange={(e) => setSelRfq(e.target.value)}
          style={{
            background: 'rgba(var(--ink-rgb),.04)',
            border: '1px solid rgba(var(--ink-rgb),.12)',
            borderRadius: 11,
            padding: '12px 14px',
            fontSize: 14,
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          {rfqs.map((r) => (
            <option key={r.id} value={r.id}>{r.ventureTitleAr} — {r.category}</option>
          ))}
        </select>
        {selected && (
          <span style={{ fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.55, marginTop: 4 }}>
            {selected.specsAr}
          </span>
        )}
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>السعر ($)</span>
          <input
            type="number" min={1} required
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="25000"
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>المهلة (يوم)</span>
          <input
            type="number" min={1} max={365} required
            value={lead} onChange={(e) => setLead(e.target.value)}
            placeholder="21"
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>الالتزام (%)</span>
          <input
            type="number" min={0} max={100} required
            value={compliance} onChange={(e) => setCompliance(e.target.value)}
            placeholder="95"
            style={inputStyle}
          />
        </label>
      </div>

      <button
        type="submit"
        style={{
          background: 'var(--grad)',
          color: 'var(--on-accent)',
          border: 'none',
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: 16,
          padding: 15,
          borderRadius: 14,
          cursor: 'pointer',
          display: 'inline-flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="send" size={20} color="var(--on-accent)" />
        أرسل العرض
      </button>
    </form>
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
