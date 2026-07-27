import type { ApiMilestonePublic, ApiPayoutRow } from '@/lib/api/wathba';
import { Num } from '../wathba-icons';
import { formatSarFromHalalas } from '@/lib/i18n/format';

/**
 * Creator payout/escrow view (Sprint 3 / P1-208) — server component, no
 * client state: one row per released tranche with disbursement status and
 * the ZATCA commission-invoice number.
 */

const TONE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'بانتظار التحويل', color: 'var(--gold-ink)',   bg: 'rgba(251,191,36,.10)' },
  SENT:    { label: 'تم التحويل',      color: 'var(--pos-ink)',    bg: 'rgba(52,211,153,.10)' },
  FAILED:  { label: 'تعثّر التحويل',    color: '#ef4444',       bg: 'rgba(239,68,68,.08)' },
};

const fmtSAR = (h: number): string => formatSarFromHalalas('ar', h);

export function WathbaDashboardPayouts({
  payouts,
  milestones,
}: {
  projectId: string;
  payouts: ApiPayoutRow[];
  milestones: ApiMilestonePublic[];
}) {
  const milestoneTitle = (id: string | null): string =>
    milestones.find((m) => m.id === id)?.titleAr ?? 'مرحلة';
  const totalSent = payouts
    .filter((p) => p.status === 'SENT')
    .reduce((acc, p) => acc + p.amountHalalas, 0);
  const totalPending = payouts
    .filter((p) => p.status === 'PENDING')
    .reduce((acc, p) => acc + p.amountHalalas, 0);

  return (
    <div className="wathba-fade" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>الدفعات والضمان</h2>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 640, lineHeight: 1.6 }}>
          كل مرحلة مُعتمدة تتحوّل إلى دفعة من حساب الضمان. تجد هنا حالة كل دفعة
          ورقم الفاتورة الضريبية (زاتكا) لعمولة المنصة.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Stat label="إجمالي المُحوَّل" value={fmtSAR(totalSent)} color="var(--pos)" />
        <Stat label="بانتظار التحويل" value={fmtSAR(totalPending)} color="var(--gold)" />
        <Stat label="عدد الدفعات" value={String(payouts.length)} color="var(--accent)" />
      </div>

      {payouts.length === 0 ? (
        <div
          style={{
            border: '1px dashed rgba(var(--ink-rgb),.15)',
            borderRadius: 14,
            padding: 28,
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: 14,
          }}
        >
          لا دفعات بعد — تُنشأ الدفعات تلقائياً عند اعتماد وصرف كل مرحلة.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {payouts.map((p) => {
            const tone = TONE[p.status] ?? TONE.PENDING!;
            return (
              <article
                key={p.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid rgba(var(--ink-rgb),.08)',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                    {milestoneTitle(p.milestoneId)}
                  </div>
                  <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>
                    أُنشئت: {p.createdAt.slice(0, 10)}
                    {p.sentAt ? ` · حُوِّلت: ${p.sentAt.slice(0, 10)}` : ''}
                  </Num>
                </div>
                <Num style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent-ink)' }}>
                  {fmtSAR(p.amountHalalas)}
                </Num>
                <span
                  style={{
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
                {p.zatcaInvoiceId && (
                  <Num
                    style={{
                      fontSize: 11.5,
                      color: 'var(--muted)',
                      border: '1px dashed rgba(var(--ink-rgb),.2)',
                      borderRadius: 8,
                      padding: '5px 10px',
                    }}
                  >
                    زاتكا: {p.zatcaInvoiceId}
                  </Num>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 14,
        padding: '14px 20px',
        minWidth: 160,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 4 }}>{label}</div>
      <Num style={{ fontSize: 19, fontWeight: 700, color }}>{value}</Num>
    </div>
  );
}
