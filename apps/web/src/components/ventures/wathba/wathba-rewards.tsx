'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { RichRewardTier } from './wathba-rich';
import { Icon, Num } from './wathba-icons';

/** rough SAR→USD display only (3.75 peg + 0% spread for the demo). */
const SAR_TO_USD = 1 / 3.75;

/**
 * Reward-tier list — sits in the right column of the campaign tab AND on
 * the standalone Rewards tab. Each card carries: optional Featured flag,
 * title, SAR price + ≈USD conversion, description, "what's included" list,
 * optional add-ons, backers, ships-to, est-delivery, limited quantity,
 * "+N المزيد" expander, and a "تعهّد" CTA that bounces to the auth-gated
 * pledge flow via the `next` query param.
 *
 * Also surfaces "ادعم بدون مكافأة" at the top.
 */
export function WathbaRewards({
  projectId,
  tiers,
}: {
  projectId: string;
  tiers: RichRewardTier[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="redeem" size={20} color="var(--gold)" />
        اختر مكافأتك
      </h3>

      {/* "Pledge without a reward" entry — design lifts this above the tiers. */}
      <Link
        href={`/projects/${projectId}/back?custom=1`}
        style={{
          background: 'var(--card)',
          border: '1px dashed rgba(var(--accent-rgb),.40)',
          borderRadius: 14, padding: 16,
          textDecoration: 'none', color: 'inherit',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div
          style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'rgba(var(--accent-rgb),.08)',
            color: 'var(--accent)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <Icon name="favorite" size={20} color="var(--accent)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>ادعم بدون مكافأة</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            أدخل أي مبلغ. تستلم شكراً شخصياً + تحديثات حصرية.
          </div>
        </div>
        <Icon name="arrow_forward" size={18} color="var(--muted)" />
      </Link>

      {tiers.map((t) => (
        <RewardCard key={t.id} projectId={projectId} tier={t} />
      ))}
    </div>
  );
}

function RewardCard({ projectId, tier: t }: { projectId: string; tier: RichRewardTier }) {
  const [expanded, setExpanded] = useState(false);
  const soldOut = t.limit != null && t.claimed >= t.limit;
  const remaining = t.limit != null ? Math.max(0, t.limit - t.claimed) : null;
  const usd = Math.round(t.priceSar * SAR_TO_USD);
  const allIncludes = [...t.includes, ...(t.addOns ?? [])];
  const visible = expanded ? allIncludes : allIncludes.slice(0, 3);
  const moreCount = allIncludes.length - visible.length;

  return (
    <article
      style={{
        position: 'relative',
        background: 'var(--card)',
        border: `1px solid ${t.featured ? 'rgba(var(--accent-rgb),.40)' : 'rgba(var(--ink-rgb),.09)'}`,
        borderRadius: 16, padding: 18,
        boxShadow: t.featured ? '0 14px 30px -16px rgba(var(--accent-rgb),.30)' : 'none',
      }}
    >
      {t.featured && (
        <span
          style={{
            position: 'absolute', top: -10, right: 16,
            background: 'var(--grad)', color: 'var(--on-accent)',
            padding: '3px 12px', borderRadius: 20,
            fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <Icon name="check_circle" size={12} color="var(--on-accent)" />
          الأكثر شعبية
        </span>
      )}

      {t.limitedBadge && (
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--gold)',
            background: 'rgba(251,191,36,.10)',
            border: '1px solid rgba(251,191,36,.30)',
            padding: '3px 10px', borderRadius: 20,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            marginBottom: 8,
          }}
        >
          <Icon name="check_circle" size={12} color="var(--gold)" />
          {t.limitedBadge}
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <Num style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
            {t.priceSar.toLocaleString('en-US')} ر.س
          </Num>
          <Num style={{ fontSize: 12, color: 'var(--muted2)', display: 'block', marginTop: 2 }}>
            ≈ ${usd.toLocaleString('en-US')}
          </Num>
        </div>
        <Num style={{ fontSize: 12, color: 'var(--muted2)' }}>
          {t.backers.toLocaleString('en-US')} داعم
        </Num>
      </div>

      <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 7 }}>{t.title}</h4>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)', marginBottom: 13 }}>{t.description}</p>

      <div style={{ borderTop: '1px solid rgba(var(--ink-rgb),.07)', paddingTop: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>
          ما يتضمنه:
        </div>
        {visible.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: 'var(--text-soft)', marginBottom: 6,
            }}
          >
            <Icon name="check_circle" size={15} color="var(--pos)" />
            {line}
          </div>
        ))}
        {moreCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontFamily: 'inherit', cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: 'var(--accent)', fontSize: 12, fontWeight: 700,
              padding: 0, marginTop: 4,
            }}
          >
            {expanded ? '— عرض أقل' : `+${moreCount} المزيد`}
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
          fontSize: 12, color: 'var(--muted2)',
          borderTop: '1px solid rgba(var(--ink-rgb),.07)',
          paddingTop: 12, marginBottom: 12,
        }}
      >
        <Detail label="يُشحن إلى" value={t.shipsTo} />
        <Detail label="موعد التسليم" value={t.estDelivery} />
      </div>

      {remaining != null && !soldOut && (
        <div
          style={{
            fontSize: 11.5, fontWeight: 700,
            color: 'var(--gold)',
            background: 'rgba(251,191,36,.07)',
            padding: '6px 10px', borderRadius: 9,
            marginBottom: 10,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <Icon name="lightbulb" size={12} color="var(--gold)" />
          {remaining} متبقٍ من {t.limit}
        </div>
      )}

      {soldOut ? (
        <button
          type="button" disabled
          style={{
            width: '100%', background: 'rgba(var(--ink-rgb),.08)',
            color: 'var(--muted2)', border: 'none', fontFamily: 'inherit',
            fontWeight: 700, fontSize: 14, padding: 12, borderRadius: 12,
            cursor: 'not-allowed',
          }}
        >
          نفِد المخزون
        </button>
      ) : (
        <Link
          href={`/projects/${projectId}/back?tier=${t.id}`}
          style={{
            display: 'block', textAlign: 'center',
            background: t.featured ? 'var(--grad)' : 'transparent',
            color: t.featured ? 'var(--on-accent)' : 'var(--accent)',
            border: t.featured ? 'none' : '1px solid var(--accent)',
            fontWeight: 700, fontSize: 14, padding: 12,
            borderRadius: 12, textDecoration: 'none',
          }}
        >
          تعهّد بـ {t.priceSar.toLocaleString('en-US')} ر.س
        </Link>
      )}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'var(--muted2)', fontSize: 11 }}>{label}</div>
      <div style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
