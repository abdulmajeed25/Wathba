'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { ApiBackingRow, ApiPayoutsPayload } from '@/lib/api/wathba';
import { wathbaProjects } from './wathba-data';
import { EmptyState } from './wathba-states';
import { Icon, Num } from './wathba-icons';

/**
 * §6.5B Payments hub — 4 tabs.
 *
 * Methods: Wathba doesn't store cards — Moyasar tokenizes on its end and
 *          retains the card. We surface the explanation + a "manage on
 *          Moyasar" link rather than a fake list.
 * History: unified ledger from pledges/me (debits/credits/refunds).
 * Refunds: filtered view of History showing only REFUNDED rows.
 * Wallet:  creator payouts from /v1/payouts/me with SENT vs PENDING totals.
 */

type TabId = 'methods' | 'history' | 'refunds' | 'wallet';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'methods', label: 'طرق الدفع',     icon: 'credit_card' },
  { id: 'history', label: 'سجل المعاملات', icon: 'auto_stories' },
  { id: 'refunds', label: 'الاستردادات',    icon: 'check' },
  { id: 'wallet',  label: 'محفظتي (للمبدع)', icon: 'workspace_premium' },
];

const STATE_TONE: Record<string, { label: string; color: string; bg: string }> = {
  HELD:     { label: 'محجوز',     color: 'var(--gold)',   bg: 'rgba(251,191,36,.10)' },
  CAPTURED: { label: 'تم الخصم',  color: 'var(--pos)',    bg: 'rgba(52,211,153,.10)' },
  REFUNDED: { label: 'مسترَد',    color: 'var(--muted)',  bg: 'rgba(var(--ink-rgb),.06)' },
  FAILED:   { label: 'فشل',       color: '#dc2626',       bg: 'rgba(239,68,68,.08)' },
  PENDING:  { label: 'قيد الإرسال', color: 'var(--gold)', bg: 'rgba(251,191,36,.10)' },
  SENT:     { label: 'تم التحويل',  color: 'var(--pos)',  bg: 'rgba(52,211,153,.10)' },
};

export function WathbaPayments({
  pledges,
  payouts,
}: {
  pledges?: ApiBackingRow[] | null;
  payouts?: ApiPayoutsPayload | null;
} = {}) {
  const [tab, setTab] = useState<TabId>('history');
  const refunded = (pledges ?? []).filter((p) => p.state.toUpperCase() === 'REFUNDED');

  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 26px 0' }}>
        <Num style={{ display: 'block', fontSize: 12, letterSpacing: 2, color: 'var(--accent)', marginBottom: 8 }}>
          PAYMENTS · المدفوعات
        </Num>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 8 }}>
          المدفوعات والمحفظة
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-soft)', maxWidth: 720, lineHeight: 1.6 }}>
          إدارة طرق الدفع، سجل المعاملات، الاستردادات، ومحفظة المبدع.
          المعاملات تتم عبر مَيسر (مزوّد دفع مرخّص في المملكة).
        </p>
      </section>

      <section
        style={{
          maxWidth: 1040,
          margin: '28px auto 0',
          padding: '0 26px',
          borderBottom: '1px solid rgba(var(--ink-rgb),.08)',
        }}
      >
        <div style={{ display: 'flex', gap: 26, overflowX: 'auto' }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  cursor: 'pointer',
                  padding: '14px 2px',
                  background: 'transparent',
                  borderTop: 'none',
                  borderInline: 'none',
                  borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 14.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
              >
                <Icon name={t.icon} size={18} />
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 26px 80px' }}>
        {tab === 'methods' && <MethodsTab />}
        {tab === 'history' && <HistoryTab pledges={pledges ?? []} />}
        {tab === 'refunds' && (
          refunded.length === 0 ? (
            <EmptyState
              icon="check"
              title="لا استردادات في حسابك"
              body="ستظهر هنا أي مبالغ يُسترد فيها دعمك (مثلاً عند فشل حملة في بلوغ عتبة ٨٠٪)."
            />
          ) : (
            <HistoryTab pledges={refunded} />
          )
        )}
        {tab === 'wallet' && <WalletTab payouts={payouts} />}
      </section>
    </div>
  );
}

function MethodsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <article
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(var(--ink-rgb),.08)',
          borderRadius: 16,
          padding: 22,
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(var(--accent-rgb),.10)',
            color: 'var(--accent)',
            display: 'grid', placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="lock" size={22} color="var(--accent)" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            بطاقاتك محفوظة بأمان لدى مَيسر
          </h3>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65 }}>
            وثبة لا تحفظ بيانات بطاقاتك أبداً. مَيسر — مزوّد الدفع المرخّص من
            البنك المركزي السعودي — يتولى تخزينها بأعلى معايير الأمان (PCI DSS).
            تظهر هذه البطاقات تلقائياً عند الدعم التالي.
          </p>
        </div>
      </article>

      <article
        style={{
          background: 'rgba(var(--accent-rgb),.05)',
          border: '1px solid rgba(var(--accent-rgb),.18)',
          borderRadius: 14,
          padding: 18,
          fontSize: 14,
          color: 'var(--text-soft)',
          lineHeight: 1.65,
          display: 'flex',
          gap: 12,
        }}
      >
        <Icon name="shield" size={20} color="var(--accent)" />
        <span>
          عند الدعم نُجري عملية حجز (Authorize) فقط على بطاقتك. لا يُخصم أي
          مبلغ فعلياً قبل نجاح الحملة. إن فشلت الحملة يُحرَّر الحجز تلقائياً
          خلال ٧ أيام عمل بنكية.
        </span>
      </article>
    </div>
  );
}

function HistoryTab({ pledges }: { pledges: ApiBackingRow[] }) {
  if (pledges.length === 0) {
    return (
      <EmptyState
        icon="auto_stories"
        title="لا معاملات بعد"
        body="عند دعمك لأول مشروع ستظهر تفاصيله هنا — تاريخ، مبلغ، حالة، ومرجع الدفع."
      />
    );
  }
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(var(--ink-rgb),.03)', fontSize: 12.5, color: 'var(--muted2)' }}>
            <th style={{ textAlign: 'start', padding: '14px 18px', fontWeight: 600 }}>التاريخ</th>
            <th style={{ textAlign: 'start', padding: '14px 18px', fontWeight: 600 }}>المشروع</th>
            <th style={{ textAlign: 'end',   padding: '14px 18px', fontWeight: 600 }}>المبلغ</th>
            <th style={{ textAlign: 'end',   padding: '14px 18px', fontWeight: 600 }}>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {pledges.map((p, i) => {
            const tone = STATE_TONE[p.state.toUpperCase()] ?? STATE_TONE.HELD!;
            const projectAr =
              p.venture?.title ??
              wathbaProjects.find((wp) => wp.id === p.ventureId)?.titleAr ??
              'مشروع';
            return (
              <tr
                key={p.id}
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid rgba(var(--ink-rgb),.04)',
                  fontSize: 13.5,
                }}
              >
                <td style={{ padding: '14px 18px', color: 'var(--muted)' }}>
                  <Num>{new Date(p.committedAt).toLocaleDateString('ar-SA')}</Num>
                </td>
                <td style={{ padding: '14px 18px', color: 'var(--text)' }}>
                  {projectAr}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'end', fontWeight: 700 }}>
                  <Num style={{ color: p.state.toUpperCase() === 'REFUNDED' ? 'var(--muted)' : 'var(--accent)' }}>
                    {(Number(p.amount) / 100).toLocaleString('en-US')} ر.س
                  </Num>
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'end' }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '4px 11px',
                      borderRadius: 20,
                      background: tone.bg,
                      color: tone.color,
                    }}
                  >
                    {tone.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WalletTab({ payouts }: { payouts: ApiPayoutsPayload | null | undefined }) {
  // TanStack Query: SSR-pre-fetched data seeds `initialData`; the hook then
  // polls /v1/payouts/me every 60 s so PENDING → SENT transitions surface
  // without a page reload.
  const { data, isFetching, refetch } = useQuery<ApiPayoutsPayload | null>({
    queryKey: ['payouts', 'me'],
    queryFn: async () => {
      const r = await fetch('/api/payouts/me', { credentials: 'include' });
      if (!r.ok) return null;
      return (await r.json()) as ApiPayoutsPayload;
    },
    initialData: payouts ?? undefined,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const sent = (data?.totalSentHalalas ?? 0) / 100;
  const items = data?.items ?? [];
  const pending = items
    .filter((p) => p.status === 'PENDING')
    .reduce((a, p) => a + p.amountHalalas, 0) / 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* totals */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {isFetching && (
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          )}
          {isFetching ? 'جاري التحديث…' : 'يُحدّث تلقائياً كل دقيقة'}
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          style={{
            fontFamily: 'inherit', cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb),.16)',
            color: 'var(--muted)', fontSize: 12, fontWeight: 600,
            padding: '6px 14px', borderRadius: 11,
          }}
        >
          تحديث الآن
        </button>
      </div>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <TotalCard
          label="تم التحويل"
          value={`${sent.toLocaleString('en-US')} ر.س`}
          icon="check_circle"
          color="var(--pos)"
          bg="rgba(52,211,153,.10)"
        />
        <TotalCard
          label="قيد التحويل"
          value={`${pending.toLocaleString('en-US')} ر.س`}
          icon="info"
          color="var(--gold)"
          bg="rgba(251,191,36,.10)"
        />
      </div>

      {/* list */}
      {items.length === 0 ? (
        <EmptyState
          icon="workspace_premium"
          title="لا توجد عمليات صرف بعد"
          body="ستظهر هنا كل دفعة تتسلّمها مقابل مرحلة من مشاريعك بعد الموافقة والصرف."
        />
      ) : (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(var(--ink-rgb),.03)', fontSize: 12.5, color: 'var(--muted2)' }}>
                <th style={{ textAlign: 'start', padding: '14px 18px', fontWeight: 600 }}>التاريخ</th>
                <th style={{ textAlign: 'start', padding: '14px 18px', fontWeight: 600 }}>المشروع</th>
                <th style={{ textAlign: 'end',   padding: '14px 18px', fontWeight: 600 }}>المبلغ</th>
                <th style={{ textAlign: 'end',   padding: '14px 18px', fontWeight: 600 }}>فاتورة ZATCA</th>
                <th style={{ textAlign: 'end',   padding: '14px 18px', fontWeight: 600 }}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, i) => {
                const tone = STATE_TONE[p.status] ?? STATE_TONE.PENDING!;
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid rgba(var(--ink-rgb),.04)',
                      fontSize: 13.5,
                    }}
                  >
                    <td style={{ padding: '14px 18px', color: 'var(--muted)' }}>
                      <Num>{new Date(p.createdAt).toLocaleDateString('ar-SA')}</Num>
                    </td>
                    <td style={{ padding: '14px 18px' }}>{p.projectId.slice(0, 8)}…</td>
                    <td style={{ padding: '14px 18px', textAlign: 'end', fontWeight: 700 }}>
                      <Num style={{ color: 'var(--accent)' }}>
                        {(p.amountHalalas / 100).toLocaleString('en-US')} ر.س
                      </Num>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'end' }}>
                      {p.zatcaInvoiceId ? (
                        <Num style={{ fontSize: 12, color: 'var(--accent)' }}>
                          {p.zatcaInvoiceId.slice(0, 10)}…
                        </Num>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--muted2)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'end' }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '4px 11px',
                          borderRadius: 20,
                          background: tone.bg,
                          color: tone.color,
                        }}
                      >
                        {tone.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
        فواتير ZATCA Phase 2 تُصدر تلقائياً على عمولة المنصة فقط (٥٪) ولا تشمل
        مبلغ الدعم الأصلي. تستلم نسخة PDF + QR على بريدك بعد كل صرف.
      </p>
    </div>
  );
}

function TotalCard({
  label, value, icon, color, bg,
}: { label: string; value: string; icon: string; color: string; bg: string }) {
  return (
    <article
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 16,
        padding: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: bg, color,
            display: 'grid', placeItems: 'center',
          }}
        >
          <Icon name={icon} size={20} color={color} />
        </div>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      </div>
      <Num style={{ fontSize: 26, fontWeight: 700 }}>{value}</Num>
    </article>
  );
}
