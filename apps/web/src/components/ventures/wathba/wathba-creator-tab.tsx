'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { type ApiCreatorProfile } from '@/lib/api/wathba';

/**
 * Public "المبدع" tab on the project page — avatar, verified badge, follow
 * button, stats, bio, website pill, collaborators, and a small grid of the
 * creator's other projects. Uses TanStack Query for the read + follow
 * mutation. Follow is gated on having an httpOnly `wathba_session` cookie
 * (we infer via response code from /api/creators/.../follow — the proxy
 * 401's anonymous users).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function fetchProfile(userId: string): Promise<ApiCreatorProfile | null> {
  const url = API_BASE
    ? `${API_BASE}/v1/creators/${userId}`
    : `/v1/creators/${userId}`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as ApiCreatorProfile;
  } catch {
    return null;
  }
}

async function postFollow(userId: string, action: 'follow' | 'unfollow'): Promise<boolean> {
  // Always proxy via /api/creators/:userId/follow so the httpOnly bearer
  // cookie can be forwarded to the API.
  try {
    const res = await fetch(`/api/creators/${userId}/follow`, {
      method: action === 'follow' ? 'POST' : 'DELETE',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function WathbaCreatorTab({
  userId,
  isAuthenticated = false,
  initialData,
  initiallyFollowing = false,
}: {
  userId: string;
  isAuthenticated?: boolean;
  initialData?: ApiCreatorProfile | null;
  initiallyFollowing?: boolean;
}): React.ReactElement {
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(initiallyFollowing);

  const { data, isLoading } = useQuery({
    queryKey: ['creator', userId],
    queryFn: () => fetchProfile(userId),
    initialData: initialData ?? undefined,
    staleTime: 60_000,
  });

  const followMutation = useMutation({
    mutationFn: async (action: 'follow' | 'unfollow') => postFollow(userId, action),
    onSuccess: (ok, action) => {
      if (!ok) return;
      setFollowing(action === 'follow');
      void queryClient.invalidateQueries({ queryKey: ['creator', userId] });
    },
  });

  if (isLoading && !data) {
    return (
      <div
        style={{
          height: 200,
          borderRadius: 12,
          background: 'linear-gradient(90deg, #eef1ed 0%, #f8faf6 50%, #eef1ed 100%)',
          animation: 'wathba-pulse 1.4s ease-in-out infinite',
        }}
      />
    );
  }

  if (!data) {
    return (
      <div
        style={{
          padding: 16,
          background: 'var(--bg-elevated, #fff)',
          border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
          borderRadius: 12,
          color: 'var(--text-secondary, #3b4942)',
          fontSize: 13,
        }}
      >
        تعذّر تحميل بيانات المبدع. حاول لاحقاً.
      </div>
    );
  }

  return (
    <section dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 16,
          background: 'var(--bg-elevated, #fff)',
          border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
          borderRadius: 12,
        }}
      >
        <Avatar url={data.avatarUrl} name={data.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{data.name}</h2>
            {data.nafathVerified && <VerifiedBadge />}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>
            <span>{fmt(data.followersCount)} متابِع</span>
            <span>·</span>
            <span>{fmt(data.createdProjectsCount)} مشروعاً أنشأها</span>
            <span>·</span>
            <span>{fmt(data.backedProjectsCount)} مشروعاً دعمها</span>
          </div>
        </div>
        <FollowButton
          authenticated={isAuthenticated}
          following={following}
          loading={followMutation.isPending}
          onClick={() => followMutation.mutate(following ? 'unfollow' : 'follow')}
        />
      </header>

      {data.bioAr && (
        <div
          style={{
            padding: 16,
            background: 'var(--bg-elevated, #fff)',
            border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
            borderRadius: 12,
            fontSize: 14,
            lineHeight: 1.8,
            color: 'var(--text-primary, #16201b)',
          }}
        >
          {data.bioAr}
        </div>
      )}

      {(data.websiteUrl || data.collaborators.length > 0) && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {data.websiteUrl && (
            <a
              href={data.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '6px 12px',
                background: 'var(--bg-elevated, #fff)',
                border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
                borderRadius: 999,
                fontSize: 12,
                color: 'var(--brand-primary, #05a661)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              الموقع الإلكتروني ↗
            </a>
          )}
          {data.collaborators.map((c, i) => (
            <span
              key={`${c.nameAr}-${i}`}
              style={{
                padding: '6px 12px',
                background: 'rgba(5,166,97,0.08)',
                border: '1px solid rgba(5,166,97,0.16)',
                borderRadius: 999,
                fontSize: 12,
                color: 'var(--text-primary, #16201b)',
              }}
            >
              {c.nameAr}
              {c.role ? <span style={{ opacity: 0.65 }}> · {c.role}</span> : null}
            </span>
          ))}
        </div>
      )}

      {data.pastProjects.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 10 }}>
            مشاريع أخرى لهذا المبدع
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {data.pastProjects.map((p) => (
              <PastProjectCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes wathba-pulse { 0% { opacity: .6 } 50% { opacity: 1 } 100% { opacity: .6 } }`}</style>
    </section>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }): React.ReactElement {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={56}
        height={56}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  const initial = name.slice(0, 1) || '?';
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'rgba(5,166,97,0.16)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 22,
        color: 'var(--brand-primary, #05a661)',
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

function VerifiedBadge(): React.ReactElement {
  return (
    <span
      title="نافذ موثَّق"
      aria-label="نافذ موثَّق"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: 'rgba(5,166,97,0.12)',
        color: 'var(--brand-primary, #05a661)',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      ✓ نافذ موثَّق
    </span>
  );
}

function FollowButton({
  authenticated,
  following,
  loading,
  onClick,
}: {
  authenticated: boolean;
  following: boolean;
  loading: boolean;
  onClick: () => void;
}): React.ReactElement {
  if (!authenticated) {
    return (
      <a
        href="/sign-in"
        style={{
          padding: '8px 16px',
          background: 'var(--bg-elevated, #fff)',
          border: '1px solid var(--brand-primary, #05a661)',
          color: 'var(--brand-primary, #05a661)',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          textDecoration: 'none',
        }}
      >
        سجّل لتتابع
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '8px 16px',
        background: following ? 'var(--bg-elevated, #fff)' : 'var(--brand-primary, #05a661)',
        color: following ? 'var(--brand-primary, #05a661)' : '#fff',
        border: '1px solid var(--brand-primary, #05a661)',
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 13,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {following ? 'متابَع' : 'متابعة'}
    </button>
  );
}

function PastProjectCard({
  p,
}: {
  p: {
    id: string;
    titleAr: string;
    fundedPct: number;
    delivered: boolean;
  };
}): React.ReactElement {
  const pct = Math.min(100, p.fundedPct);
  return (
    <a
      href={`/projects/${p.id}`}
      style={{
        display: 'block',
        padding: 12,
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        textDecoration: 'none',
        color: 'var(--text-primary, #16201b)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          minHeight: 36,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {p.titleAr}
      </div>
      <div
        style={{
          height: 5,
          background: 'rgba(5,166,97,0.16)',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${pct}%`,
            background: 'var(--brand-primary, #05a661)',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary, #5d6b62)' }}>
          {p.fundedPct}% من الهدف
        </span>
        {p.delivered && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 999,
              background: 'rgba(5,166,97,0.12)',
              color: 'var(--brand-primary, #05a661)',
            }}
          >
            تم الوفاء
          </span>
        )}
      </div>
    </a>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
