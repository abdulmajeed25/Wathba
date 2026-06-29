'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

import { Icon, Num } from './wathba-icons';

/**
 * Right-side sticky funding rail. Top: raised / goal / pct / progress bar +
 * 80% threshold disclosure. Middle: backers / days-left. Bottom: primary
 * CTA (auth-gated via the `next` query param) + remind + share row.
 *
 * Renders inside both the header and the campaign-tab right column.
 */
export function WathbaCampaignRail({
  projectId,
  projectTitle,
  raisedFmt,
  goalFmt,
  pct,
  pctW,
  pctColor,
  barGrad,
  backersFmt,
  daysLeft,
  releaseThresholdPct = 80,
  goal,
  variant = 'sidebar',
}: {
  projectId: string;
  projectTitle: string;
  raisedFmt: string;
  goalFmt: string;
  pct: number;
  pctW: string;
  pctColor: string;
  barGrad: string;
  backersFmt: string;
  daysLeft: number;
  releaseThresholdPct?: number;
  goal: number;
  variant?: 'sidebar' | 'header';
}) {
  const thresholdAmount = Math.round(goal * (releaseThresholdPct / 100));
  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.09)',
        borderRadius: 20,
        padding: 24,
        ...(variant === 'sidebar' ? { position: 'sticky', top: 96 } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <Num style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>{raisedFmt}</Num>
        <Num style={{ fontSize: 16, fontWeight: 700, color: pctColor }}>{pct}%</Num>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 16 }}>
        مُموَّل من هدف {goalFmt}
      </div>
      <div
        style={{
          height: 9, borderRadius: 30,
          background: 'rgba(var(--ink-rgb),.08)',
          overflow: 'hidden', marginBottom: 16,
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: pctW }}
          transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ height: '100%', background: barGrad, borderRadius: 30 }}
        />
      </div>

      {/* 80% threshold disclosure — distinct from Kickstarter's "all-or-nothing" */}
      <div
        style={{
          marginBottom: 18,
          display: 'flex', alignItems: 'flex-start', gap: 9,
          background: 'rgba(var(--accent-rgb),.07)',
          border: '1px solid rgba(var(--accent-rgb),.20)',
          borderRadius: 12, padding: '10px 12px',
        }}
      >
        <Icon name="lightbulb" size={18} color="var(--accent)" />
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-soft)' }}>
          يُموَّل عند بلوغ{' '}
          <Num style={{ fontWeight: 700, color: 'var(--accent)' }}>
            {thresholdAmount.toLocaleString('en-US')} ر.س ({releaseThresholdPct}%)
          </Num>{' '}
          من الهدف قبل الموعد النهائي. وإلا، تُرَدّ كل الأموال تلقائياً.
        </div>
      </div>

      <div style={{ display: 'flex', marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <Num style={{ fontSize: 22, fontWeight: 700 }}>{backersFmt}</Num>
          <div style={{ fontSize: 12, color: 'var(--muted2)' }}>داعم</div>
        </div>
        <div style={{ width: 1, background: 'rgba(var(--ink-rgb),.1)' }} />
        <div style={{ flex: 1, paddingInlineStart: 18 }}>
          <Num style={{ fontSize: 22, fontWeight: 700 }}>{daysLeft}</Num>
          <div style={{ fontSize: 12, color: 'var(--muted2)' }}>يوم متبقٍ</div>
        </div>
      </div>

      {/* Primary CTA — auth-gated. Middleware bounces to /sign-in with `next=` */}
      <Link
        href={`/projects/${projectId}/back`}
        style={{
          width: '100%', display: 'block', textAlign: 'center',
          background: 'var(--grad)', color: 'var(--on-accent)',
          fontWeight: 700, fontSize: 16, padding: 15,
          borderRadius: 14, marginBottom: 10, textDecoration: 'none',
        }}
      >
        ادعم هذا المشروع
      </Link>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <button
          type="button"
          style={{
            flex: 1, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb),.16)',
            color: 'var(--text)', fontWeight: 600, fontSize: 13,
            padding: '10px', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, fontFamily: 'inherit',
          }}
        >
          <Icon name="notifications" size={16} /> ذكّرني
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.share) {
              void navigator.share({ title: projectTitle, url: window.location.href });
            } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
              void navigator.clipboard.writeText(window.location.href);
            }
          }}
          style={{
            flex: 1, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb),.16)',
            color: 'var(--text)', fontWeight: 600, fontSize: 13,
            padding: '10px', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, fontFamily: 'inherit',
          }}
        >
          <Icon name="share" size={16} /> شارك
        </button>
      </div>
    </motion.aside>
  );
}
