import Link from 'next/link';

import type { ApiBackingRow } from '@/lib/api/wathba';
import { wathbaProjects } from './wathba-data';
import { EmptyState } from './wathba-states';
import { Icon, Num } from './wathba-icons';

/**
 * Backer's "my pledges" screen — lists the current user's HELD / CAPTURED /
 * REFUNDED pledges. Server-pre-fetched from /v1/pledges/me. Falls back to a
 * built-in empty state when no rows (fresh account / empty DB).
 */

const STATE_TONE: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  HELD:      { label: 'محجوز · بانتظار النجاح',  bg: 'rgba(251,191,36,.10)',  color: 'var(--gold)',   border: 'rgba(251,191,36,.30)' },
  CAPTURED:  { label: 'تم الخصم',                bg: 'rgba(52,211,153,.10)',  color: 'var(--pos)',    border: 'rgba(52,211,153,.30)' },
  REFUNDED:  { label: 'مسترَد',                   bg: 'rgba(var(--ink-rgb),.06)', color: 'var(--muted)', border: 'rgba(var(--ink-rgb),.20)' },
  FAILED:    { label: 'فشل الدفع',                bg: 'rgba(239,68,68,.08)',  color: '#dc2626',       border: 'rgba(239,68,68,.30)' },
};

export function WathbaMyPledges({ pledges }: { pledges?: ApiBackingRow[] | null }) {
  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 920, margin: '0 auto', padding: '48px 26px 80px' }}>
        <Num style={{ display: 'block', fontSize: 12, letterSpacing: 2, color: 'var(--accent)', marginBottom: 8 }}>
          MY PLEDGES · مكفوفاتي
        </Num>
        <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.8px', marginBottom: 8 }}>
          مشاريع دعمتُها
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-soft)', maxWidth: 640, lineHeight: 1.6, marginBottom: 28 }}>
          تتبّع كل المشاريع التي دعمتها وحالة كل دعم. المبلغ يُخصم فعلياً فقط
          عند نجاح المشروع؛ إن فشلت الحملة يُسترد كامل المبلغ تلقائياً.
        </p>

        {(!pledges || pledges.length === 0) ? (
          <EmptyState
            icon="favorite"
            title="لم تدعم أي مشروع بعد"
            body="ابدأ رحلتك بدعم أول مشروع — كل دعم محجوز فقط ويُخصم عند نجاح الحملة."
            cta={
              <Link
                href="/projects/discover"
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
                استكشف المشاريع
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
                      {new Date(p.committedAt).toLocaleDateString('ar-SA')}
                    </Num>
                  </div>
                  <Num style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>
                    {(Number(p.amount) / 100).toLocaleString('en-US')} ر.س
                  </Num>
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
                    {tone.label}
                  </span>
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
                      إدارة الدعم
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
