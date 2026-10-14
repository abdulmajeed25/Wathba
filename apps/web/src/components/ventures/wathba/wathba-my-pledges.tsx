import Link from 'next/link';

import type { ApiBackingRow } from '@/lib/api/wathba';
import { wathbaProjects } from './wathba-data';
import { EmptyState } from './wathba-states';
import { Icon, Num } from './wathba-icons';
import { PledgeActions } from './wathba-pledge-actions';
import { formatSarExact } from '@/lib/i18n/format';

/**
 * Backer's "my pledges" screen — lists the current user's HELD / CAPTURED /
 * REFUNDED pledges. Server-pre-fetched from /v1/pledges/me. Falls back to a
 * built-in empty state when no rows (fresh account / empty DB).
 */

const STATE_TONE: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  PENDING_AUTH: { label: 'جارٍ التحقق من الحجز — لم يُحتسب الدعم بعد', bg: 'rgba(251,191,36,.10)', color: 'var(--gold-ink)', border: 'rgba(251,191,36,.30)' },
  HELD:      { label: 'محجوز · بانتظار النجاح',  bg: 'rgba(251,191,36,.10)',  color: 'var(--gold-ink)',   border: 'rgba(251,191,36,.30)' },
  CAPTURED:  { label: 'تم الخصم',                bg: 'rgba(52,211,153,.10)',  color: 'var(--pos-ink)',    border: 'rgba(52,211,153,.30)' },
  REFUNDED:  { label: 'مسترَد',                   bg: 'rgba(var(--ink-rgb),.06)', color: 'var(--muted)', border: 'rgba(var(--ink-rgb),.20)' },
  FAILED:    { label: 'فشل الدفع',                bg: 'rgba(239,68,68,.08)',  color: '#dc2626',       border: 'rgba(239,68,68,.30)' },
  // Batch PAY — the new pledge states.
  PENDING_BNPL:   { label: 'تقسيط معلّق · حتى نجاح الحملة', bg: 'rgba(96,165,250,.10)', color: 'var(--blue)', border: 'rgba(96,165,250,.30)' },
  CAPTURE_GRACE:  { label: 'بانتظار إتمام الدفع', bg: 'rgba(251,191,36,.12)', color: 'var(--gold-ink)', border: 'rgba(251,191,36,.35)' },
  FAILED_CAPTURE: { label: 'تعذّر التحصيل',            bg: 'rgba(239,68,68,.08)', color: '#dc2626', border: 'rgba(239,68,68,.30)' },
  PENDING_REAUTH: { label: 'بانتظار تحديث التفويض',           bg: 'rgba(251,191,36,.10)', color: 'var(--gold-ink)', border: 'rgba(251,191,36,.30)' },
};

export function WathbaMyPledges({ pledges }: { pledges?: ApiBackingRow[] | null }) {
  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 920, margin: '0 auto', padding: '48px 26px 80px' }}>
        <Num style={{ display: 'block', fontSize: 12, letterSpacing: 2, color: 'var(--accent-ink)', marginBottom: 8 }}>
          MY PLEDGES · تعهّداتي
        </Num>
        <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 8 }}>
          مشاريع دعمتُها
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-soft)', maxWidth: 640, lineHeight: 1.6, marginBottom: 28 }}>
          تتبّع المشاريع التي دعمتها وحالة كل تعهد. نجاح الحملة يبدأ إجراءات
          التحصيل؛ راجع الحالة هنا للتحقق من التحصيل أو فك الحجز أو الاسترداد.
        </p>

        {pledges == null ? <div role="alert"><p>تعذّر تحميل التعهدات. أعد المحاولة للتحقق من حالتها.</p><Link href="/projects/me/pledges" prefetch={false}>إعادة المحاولة</Link></div> : pledges.length === 0 ? (
          <EmptyState
            icon="favorite"
            title="لم تدعم أي مشروع بعد"
            body="استكشف المشاريع، واقرأ شروط الدعم ووسيلة الدفع قبل تأكيد تعهدك."
            cta={
              <Link
                href="/projects/discover-all"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--grad)',
                  color: 'var(--on-accent)',
                  textDecoration: 'none',
                  padding: '10px 18px',
                  borderRadius: 11,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                <Icon name="explore" size={16} color="var(--on-accent)" />
                اكتشف المشاريع
              </Link>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pledges.map((p) => {
              const tone = STATE_TONE[p.state.toUpperCase()] ?? STATE_TONE.HELD!;
              // venture data may not be on the row — fall back to a fixture lookup.
              const projectAr =
                p.venture?.title ??
                wathbaProjects.find((wp) => wp.id === p.ventureId)?.titleAr ??
                'مشروع';
              return (
                <article
                  key={p.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid rgba(var(--ink-rgb),.08)',
                    borderRadius: 14,
                    padding: 18,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div className="wathba-ph" style={{ width: 64, height: 64, borderRadius: 11, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{projectAr}</h3>
                    <Num style={{ fontSize: 12, color: 'var(--muted2)', display: 'block', marginTop: 4 }}>
                      {new Date(p.committedAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn')}
                    </Num>
                  </div>
                  <Num style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent-ink)' }}>
                    {formatSarExact('ar', Number(p.amount) / 100)}
                  </Num>
                  {p.shippingHalalas != null && p.shippingHalalas > 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    منها {formatSarExact('ar', p.shippingHalalas / 100)} شحن وفق تعهدك
                  </span>}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '6px 14px',
                      borderRadius: 20,
                      background: tone.bg,
                      color: tone.color,
                      border: `1px solid ${tone.border}`,
                    }}
                  >
                    {p.paymentVerificationPending ? 'عملية مالية قيد التحقق'
                      : p.state.toUpperCase() === 'REFUNDED' && !p.capturedAt
                        ? p.paymentMethod === 'BNPL' ? 'أُلغي طلب التقسيط' : 'فُكّ الحجز'
                        : tone.label}
                  </span>
                  {/* Batch PAY — cancel window / grace call-to-actions. */}
                  {p.paymentVerificationPending
                    ? <p role="status" style={{ width: '100%', fontSize: 13 }}>نراجع نتيجة العملية مع مزود الدفع. لا يلزمك دفع جديد الآن؛ ستظهر النتيجة هنا بعد التحقق.</p>
                    : <PledgeActions row={p} />}
                  <Link href={`/projects/me/pledges/${p.id}/changes`} style={{ padding: '12px 8px', textDecoration: 'underline', color: 'var(--accent-ink)' }}>طلبات تغيير الشروط</Link>
                  {/* Sprint 1 / P0-202 — refund status detail per pledge */}
                  {p.state.toUpperCase() === 'REFUNDED' && (
                    <div
                      style={{
                        width: '100%',
                        fontSize: 12.5,
                        lineHeight: 1.6,
                        color: 'var(--muted)',
                        background: 'rgba(var(--ink-rgb),.035)',
                        border: '1px solid rgba(var(--ink-rgb),.08)',
                        borderRadius: 10,
                        padding: '10px 14px',
                      }}
                    >
                      {p.capturedAt ? 'سُجّل استرداد المبلغ إلى وسيلة الدفع'
                        : p.paymentMethod === 'BNPL' ? 'أُلغي طلب الدعم بالتقسيط دون تحصيل المبلغ'
                        : 'سُجّل فك حجز المبلغ لدى مزود الدفع'}
                      {p.refundedAt && (
                        <>
                          {' '}بتاريخ{' '}
                          <Num style={{ fontWeight: 600 }}>
                            {new Date(p.refundedAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn')}
                          </Num>
                        </>
                      )}
                      . {p.paymentMethod !== 'BNPL' || p.capturedAt ? 'راجع كشف وسيلة الدفع للتأكد من ظهور النتيجة.' : ''}
                      {p.paymentRef && (
                        <>
                          {' '}رقم العملية:{' '}
                          <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{p.paymentRef}</Num>
                        </>
                      )}
                    </div>
                  )}
                  {p.state.toUpperCase() === 'HELD' && p.venture?.slug && (
                    <a
                      href={`/projects/${p.venture.slug}`}
                      style={{
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: '1px solid rgba(var(--ink-rgb),.16)',
                        color: 'var(--muted)',
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      عرض المشروع
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
