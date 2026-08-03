'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import type { ApiPublicProfile } from '@/lib/api/wathba';
import { Icon, Num } from './wathba-icons';

/**
 * STAKES/C1 C4 C5 — the public profile surface behind /u/[handle].
 * Header card (avatar / name / verified / @handle / city / joined),
 * stats row, bio, website + social pills, and the created-projects grid.
 * Follow reuses the creators follow endpoint (lazy CreatorProfile).
 */

const PLATFORM_LABELS: Record<string, string> = {
  x: 'X',
  instagram: 'إنستغرام',
  linkedin: 'لينكدإن',
  youtube: 'يوتيوب',
  tiktok: 'تيك توك',
};

const STATUS_LABELS: Record<string, string> = {
  LIVE: 'نشط',
  FUNDED: 'نجح التمويل',
  FAILED: 'لم يكتمل',
  UNDER_REVIEW: 'قيد المراجعة',
  REFUNDED: 'أُلغي',
};

export function WathbaPublicProfile({
  profile,
  isAuthenticated,
  isSelf,
}: {
  profile: ApiPublicProfile;
  isAuthenticated: boolean;
  isSelf: boolean;
}) {
  return (
    <div className="wathba-fade">
      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 26px 80px' }}>
        {/* ── header card ─────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <ProfileAvatar url={profile.avatarUrl} name={profile.name} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
                  {profile.name}
                </h1>
                {profile.nafathVerified && (
                  <span style={verifiedPill}>
                    <Icon name="verified_user" size={13} color="var(--accent-ink)" /> نافذ موثَّق
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted2)' }}>
                {profile.handle && <Num style={{ fontSize: 13 }}>@{profile.handle}</Num>}
                {profile.city && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="location_on" size={14} color="var(--muted2)" /> {profile.city}
                  </span>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="schedule" size={14} color="var(--muted2)" />
                  انضم {new Date(profile.joinedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })}
                </span>
              </div>
            </div>
            {isSelf ? (
              <Link href="/projects/settings" style={editBtn}>
                <Icon name="edit" size={15} color="var(--accent-ink)" /> تعديل ملفي
              </Link>
            ) : (
              <FollowButton userId={profile.id} isAuthenticated={isAuthenticated} />
            )}
          </div>

          {/* stats */}
          <div style={{ display: 'flex', gap: 0, marginTop: 22, borderTop: '1px solid rgba(var(--ink-rgb),.07)', paddingTop: 18 }}>
            {profile.stats.backedCount !== null && (
              <>
                <Stat label="مشاريع دعمها" value={profile.stats.backedCount} />
                <StatDivider />
              </>
            )}
            <Stat label="مشاريع أنشأها" value={profile.stats.createdCount} />
            <StatDivider />
            <Stat label="متابِعون" value={profile.stats.followersCount} />
          </div>
        </div>

        {/* ── bio ─────────────────────────────────────────────────── */}
        {profile.bioAr && (
          <div style={{ ...card, marginTop: 14, fontSize: 14.5, lineHeight: 1.85, color: 'var(--text-soft)' }}>
            {profile.bioAr}
          </div>
        )}

        {/* ── website + social links (C4) ─────────────────────────── */}
        {(profile.websiteUrl || profile.socialLinks.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {profile.websiteUrl && (
              <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" style={linkPill}>
                الموقع الإلكتروني ↗
              </a>
            )}
            {profile.socialLinks.map((s) => (
              <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer" style={linkPill}>
                {PLATFORM_LABELS[s.platform] ?? s.platform} ↗
              </a>
            ))}
          </div>
        )}

        {/* ── created projects (C5) ───────────────────────────────── */}
        {profile.createdProjects.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>مشاريع أنشأها</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
              {profile.createdProjects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} style={projectCard}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, minHeight: 38, lineHeight: 1.5 }}>{p.titleAr}</div>
                  <div style={{ height: 5, background: 'rgba(var(--accent-rgb),.16)', borderRadius: 999, overflow: 'hidden', margin: '10px 0 7px' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(100, p.fundedPct)}%`, background: 'var(--accent)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Num style={{ fontSize: 12.5, color: p.fundedPct >= 100 ? 'var(--accent-ink)' : 'var(--muted2)' }}>
                      {p.fundedPct}%
                    </Num>
                    <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{STATUS_LABELS[p.status] ?? p.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {profile.createdProjects.length === 0 && !profile.bioAr && (
          <div style={{ ...card, marginTop: 14, textAlign: 'center', color: 'var(--muted2)', fontSize: 14 }}>
            لم يُنشئ هذا المستخدم مشاريع بعد — ادعمه بمتابعته حتى تصلك مشاريعه القادمة.
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── atoms ── */

export function ProfileAvatar({ url, name, size = 76 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      /* STAKES/M2 — next/image: lazy + fixed dimensions (no CLS). */
      <Image src={url} alt={name} width={size} height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(var(--accent-rgb),.25)' }} />
    );
  }
  return (
    <div aria-hidden style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(var(--accent-rgb),.14)', color: 'var(--accent-ink)',
      display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.4,
    }}>
      {(name || '؟').trim().charAt(0)}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <Num style={{ display: 'block', fontSize: 22, fontWeight: 700, color: 'var(--accent-ink)' }}>
        {value.toLocaleString('en-US')}
      </Num>
      <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>{label}</span>
    </div>
  );
}

function StatDivider() {
  return <div aria-hidden style={{ width: 1, background: 'rgba(var(--ink-rgb),.08)' }} />;
}

function FollowButton({ userId, isAuthenticated }: { userId: string; isAuthenticated: boolean }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) {
    return (
      <Link href="/sign-in" style={{ ...editBtn, color: 'var(--accent-ink)' }}>
        سجّل لتتابع
      </Link>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/creators/${userId}/follow`, {
        method: following ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (res.ok) setFollowing(!following);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={() => void toggle()} disabled={busy} style={{
      border: following ? '1px solid var(--accent)' : 'none',
      background: following ? 'transparent' : 'var(--grad)',
      color: following ? 'var(--accent-ink)' : 'var(--on-accent)',
      fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5,
      padding: '11px 22px', borderRadius: 12,
      cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
    }}>
      {following ? 'متابَع ✓' : 'متابعة'}
    </button>
  );
}

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid rgba(var(--ink-rgb),.08)',
  borderRadius: 16,
  padding: 24,
};
const verifiedPill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
  background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent-ink)',
};
const editBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '10px 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 700,
  border: '1px solid rgba(var(--accent-rgb),.4)', color: 'var(--accent-ink)',
  textDecoration: 'none', background: 'transparent',
};
const linkPill: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.1)',
  color: 'var(--accent-ink)', textDecoration: 'none',
};
const projectCard: React.CSSProperties = {
  display: 'block', padding: 14, borderRadius: 13,
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.08)',
  textDecoration: 'none', color: 'var(--text)',
};
