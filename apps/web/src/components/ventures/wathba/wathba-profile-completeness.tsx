import Link from 'next/link';

import type { ApiUserMe } from '@/lib/api/wathba';
import { Num } from './wathba-icons';
import { toArabicDigits } from './discover-all-constants';

/**
 * STAKES/S-11 F-18 (C8) — «أكمل ملفك» nudge. Six identity fields count
 * toward the score; the card lists what's missing and deep-links to the
 * settings profile tab. Renders nothing at 100% (no nag once complete).
 */

const CHECKS: Array<{ key: string; label: string; done: (me: ApiUserMe) => boolean }> = [
  { key: 'avatar', label: 'صورة شخصية', done: (m) => Boolean(m.avatarUrl) },
  { key: 'bio', label: 'نبذة عنك', done: (m) => Boolean(m.bioAr?.trim()) },
  { key: 'city', label: 'مدينتك', done: (m) => Boolean(m.city?.trim()) },
  { key: 'website', label: 'موقعك', done: (m) => Boolean(m.websiteUrl?.trim()) },
  { key: 'social', label: 'حساب تواصل', done: (m) => (m.socialLinks ?? []).length > 0 },
  { key: 'handle', label: 'مُعرّفك (@)', done: (m) => Boolean(m.handle) },
];

export function profileCompleteness(me: ApiUserMe): { pct: number; missing: string[] } {
  const done = CHECKS.filter((c) => c.done(me));
  return {
    pct: Math.round((done.length / CHECKS.length) * 100),
    missing: CHECKS.filter((c) => !c.done(me)).map((c) => c.label),
  };
}

export function WathbaProfileCompleteness({ me }: { me: ApiUserMe }) {
  const { pct, missing } = profileCompleteness(me);
  if (pct >= 100) return null;
  return (
    <div
      dir="rtl"
      data-testid="profile-completeness"
      style={{
        background: 'rgba(var(--accent-rgb),.06)',
        border: '1px solid rgba(var(--accent-rgb),.22)',
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>
          أكمل ملفك — <Num style={{ color: 'var(--accent-ink)' }}>{toArabicDigits(pct)}٪</Num>
        </span>
        <Link
          href="/projects/settings"
          style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none', flexShrink: 0 }}
        >
          أكمله الآن ←
        </Link>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`اكتمال الملف ${toArabicDigits(pct)}٪`}
        style={{ height: 6, borderRadius: 30, background: 'rgba(var(--ink-rgb),.08)', overflow: 'hidden', margin: '10px 0 8px' }}
      >
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--grad)', borderRadius: 30 }} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        ينقصك: {missing.join('، ')} — الملف المكتمل يزيد ثقة الداعمين بك.
      </div>
    </div>
  );
}
