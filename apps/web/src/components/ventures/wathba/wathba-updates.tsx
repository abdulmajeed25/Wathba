'use client';

import { useState } from 'react';

import { Icon, Num } from './wathba-icons';

/**
 * Public list of project updates — numbered cards, sorted by orderNum desc,
 * with a like counter that backers can increment (rate-limited at the API
 * layer; no per-user dedupe in v1).
 *
 * Pure presentational + optimistic-like — the parent is responsible for SSR
 * fetching the initial set via `/v1/projects/:id/updates` (see
 * `listProjectUpdates` in `@/lib/api/wathba`).
 */

export interface ApiUpdateRow {
  id: string;
  projectId: string;
  orderNum: number;
  titleAr: string;
  bodyAr: string;
  likeCount: number;
  commentCount: number;
  date: string;
}

export function WathbaUpdates({
  updates,
  isAuthenticated = false,
}: {
  updates: ApiUpdateRow[];
  isAuthenticated?: boolean;
}) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 18 }}>
        تحديثات المبدع
      </h2>
      {updates.length === 0 ? (
        <div
          style={{
            padding: 24,
            background: 'var(--card)',
            border: '1px dashed rgba(var(--ink-rgb),.10)',
            borderRadius: 16,
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: 14,
          }}
        >
          لم يُنشر أي تحديث بعد.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {updates.map((u) => (
            <UpdateCard key={u.id} update={u} isAuthenticated={isAuthenticated} />
          ))}
        </div>
      )}
    </div>
  );
}

function UpdateCard({
  update,
  isAuthenticated,
}: {
  update: ApiUpdateRow;
  isAuthenticated: boolean;
}) {
  const [likes, setLikes] = useState(update.likeCount);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const dateAr = formatDateAr(update.date);

  const onLike = async (): Promise<void> => {
    if (!isAuthenticated || busy || liked) return;
    setBusy(true);
    // Optimistic: bump immediately, then reconcile if the API returns a
    // different number.
    setLikes((n) => n + 1);
    setLiked(true);
    try {
      const res = await fetch(
        `/api/updates/${update.projectId}/${update.id}/like`,
        { method: 'POST' },
      );
      if (res.ok) {
        const json = (await res.json()) as { likeCount: number };
        if (typeof json.likeCount === 'number') setLikes(json.likeCount);
      } else {
        // Roll back optimistic bump
        setLikes((n) => Math.max(0, n - 1));
        setLiked(false);
      }
    } catch {
      setLikes((n) => Math.max(0, n - 1));
      setLiked(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.08)',
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <Num
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'rgba(var(--accent-rgb),.12)',
            color: 'var(--accent)',
            display: 'inline-grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          #{update.orderNum}
        </Num>
        <Num style={{ fontSize: 12, color: 'var(--muted2)', marginInlineStart: 'auto' }}>
          {dateAr}
        </Num>
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{update.titleAr}</h3>
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-soft)',
          lineHeight: 1.75,
          whiteSpace: 'pre-wrap',
        }}
      >
        {update.bodyAr}
      </p>
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontSize: 12.5,
          color: 'var(--muted2)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            void onLike();
          }}
          disabled={!isAuthenticated || busy || liked}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: !isAuthenticated || busy || liked ? 'default' : 'pointer',
            fontFamily: 'inherit',
            color: liked ? 'var(--accent)' : 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: 0,
          }}
          aria-label="إعجاب"
        >
          <Icon name={liked ? 'favorite' : 'favorite_border'} size={14} />
          <Num>{likes}</Num>
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Icon name="forum" size={14} />
          <Num>{update.commentCount}</Num>
        </span>
      </div>
    </article>
  );
}

function formatDateAr(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
