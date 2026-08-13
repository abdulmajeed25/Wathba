'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

import { useLiveFunding } from '@/lib/hooks/use-live-funding';
import { ReportProjectButton } from './wathba-report-project';
import { ShareButton } from './wathba-share';
import { WathbaProjectActions } from './wathba-project-actions';
import { Icon, Num } from './wathba-icons';
import { formatSar } from '@/lib/i18n/format';
import { toDisplayDigits } from './discover-all-constants';
import { displayCount } from './discover-all-constants';

const fmtSAR = (n: number): string => formatSar('ar', n);

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
  // STAKES/K3 — the report affordance only makes sense on real (UUID) projects.
  const isReal = /^[0-9a-f-]{36}$/i.test(projectId);

  // Live-funding overlay — replace raised/backers/pct when a tick arrives.
  const tick = useLiveFunding(projectId);
  const live = useMemo(() => {
    if (!tick) return null;
    const raisedSAR = Number(BigInt(tick.raisedHalalas) / 100n);
    const livePct = goal > 0 ? Math.min(999, Math.round((raisedSAR / goal) * 100)) : 0;
    return {
      raisedFmt: fmtSAR(raisedSAR),
      backersFmt: displayCount(tick.backersCount),
      pct: livePct,
      pctW: `${Math.min(100, livePct)}%`,
    };
  }, [tick, goal]);

  const showRaisedFmt = live?.raisedFmt ?? raisedFmt;
  const showBackersFmt = live?.backersFmt ?? backersFmt;
  const showPct = live?.pct ?? pct;
  const showPctW = live?.pctW ?? pctW;

  return (
    <motion.aside
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.09)',
        borderRadius: 20,
        padding: 24,
        ...(variant === 'sidebar' ? { position: 'sticky', top: 96 } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <Num
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--text)',
            transition: 'color .25s ease',
          }}
        >
          {showRaisedFmt}
        </Num>
        <Num style={{ fontSize: 16, fontWeight: 700, color: pctColor }}>%{toDisplayDigits(showPct)}</Num>
        {live && (
          <span
            aria-label="حيّ"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'wathba-pulse 1.4s ease-in-out infinite',
            }}
          />
        )}
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
          animate={{ width: showPctW }}
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
          <Num style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>
            {formatSar('ar', thresholdAmount)} (%{toDisplayDigits(releaseThresholdPct)})
          </Num>{' '}
          من الهدف قبل الموعد النهائي. وإلا، تُرَدّ كل الأموال تلقائياً.
        </div>
      </div>

      <div style={{ display: 'flex', marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <Num style={{ fontSize: 22, fontWeight: 700 }}>{showBackersFmt}</Num>
          <div style={{ fontSize: 12, color: 'var(--muted2)' }}>داعم</div>
        </div>
        <div style={{ width: 1, background: 'rgba(var(--ink-rgb),.1)' }} />
        <div style={{ flex: 1, paddingInlineStart: 18 }}>
          <Num style={{ fontSize: 22, fontWeight: 700 }}>{toDisplayDigits(daysLeft)}</Num>
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

      {/* Batch ACCOUNT / U9 — this WAS «ذكّرني»: a bell icon with no onClick and
          no handler. It looked like a subscription and did nothing, while
          saving existed only on discover cards — so the campaign page offered
          neither act for real. Now both, and visibly different from each other.
          NOT gated on `isReal`: that tests whether the id is a UUID, and a
          campaign page is addressed by SLUG — so gating on it hid these
          controls from every page a reader actually visits. The BFF resolves
          slug→uuid, so either form works here. */}
      <WathbaProjectActions projectId={projectId} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {/* STAKES/I1 — per-network share (X/WhatsApp/Telegram/copy). */}
        <ShareButton title={projectTitle} />
      </div>
      {/* STAKES/K3 — trust & safety report affordance (real projects only). */}
      {isReal && <ReportProjectButton projectId={projectId} />}
    </motion.aside>
  );
}
