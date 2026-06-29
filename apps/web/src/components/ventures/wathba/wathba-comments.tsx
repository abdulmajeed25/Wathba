'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { RichComment } from './wathba-rich';
import { Icon, Num } from './wathba-icons';

/**
 * Comments tab — cursor pagination + infinite-scroll + threading. Built to
 * scale to thousands of comments per project: only `pageSize` items are
 * rendered at a time, and IntersectionObserver loads the next page when
 * the sentinel scrolls into view.
 *
 * For now the data source is the seeded RichComment[] from wathba-rich.
 * Swapping to /v1/projects/:id/comments (when the API ships it) means
 * replacing the synchronous slice() with a fetcher; the UI doesn't change.
 */

const PAGE_SIZE = 12;

export function WathbaComments({
  projectId,
  comments,
}: {
  projectId: string;
  comments: RichComment[];
}) {
  const [page, setPage] = useState(1);
  const visible = useMemo(() => comments.slice(0, page * PAGE_SIZE), [comments, page]);
  const hasMore = visible.length < comments.length;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === 'undefined') return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: '600px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>التعليقات</h2>
        <Num style={{ fontSize: 13, color: 'var(--muted2)' }}>
          {comments.length.toLocaleString('en-US')} تعليقاً
        </Num>
      </div>

      {/* Compose box — anonymous users get an auth-gated CTA, signed-in
          users would get a real textarea (live POST endpoint TBD). */}
      <ComposeBox projectId={projectId} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {visible.map((c) => <CommentRow key={c.id} comment={c} />)}
      </div>

      {hasMore && (
        <div
          ref={sentinelRef}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 0', color: 'var(--muted2)', fontSize: 13,
          }}
        >
          <span aria-hidden style={{
            display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
            border: '2px solid rgba(var(--accent-rgb),.30)',
            borderTopColor: 'var(--accent)',
            animation: 'wathba-spinslow 0.9s linear infinite',
            marginInlineEnd: 8,
          }} />
          جاري تحميل تعليقات إضافية…
        </div>
      )}

      {!hasMore && comments.length > PAGE_SIZE && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted2)', fontSize: 12.5 }}>
          نهاية التعليقات.
        </div>
      )}
    </div>
  );
}

function ComposeBox({ projectId }: { projectId: string }) {
  return (
    <Link
      href={`/sign-in?next=${encodeURIComponent(`/projects/${projectId}#comments`)}`}
      style={{
        display: 'flex', gap: 12, alignItems: 'center',
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.09)',
        borderRadius: 14, padding: 14, marginBottom: 22,
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 11,
          background: 'rgba(var(--ink-rgb),.06)',
          color: 'var(--muted2)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <Icon name="person" size={22} />
      </div>
      <div style={{ flex: 1, fontSize: 14, color: 'var(--muted)' }}>
        شارك رأيك مع المجتمع… (يتطلب تسجيل الدخول)
      </div>
      <span
        style={{
          background: 'var(--grad)', color: 'var(--on-accent)',
          fontWeight: 700, fontSize: 13,
          padding: '8px 16px', borderRadius: 11,
        }}
      >
        نشر
      </span>
    </Link>
  );
}

function CommentRow({ comment: c, depth = 0 }: { comment: RichComment; depth?: number }) {
  return (
    <article
      style={{
        display: 'flex', gap: 12,
        paddingInlineStart: depth * 24,
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 11,
          background: c.isCreatorReply ? 'rgba(var(--accent-rgb),.10)' : 'var(--avatar)',
          color: c.isCreatorReply ? 'var(--accent)' : 'var(--text)',
          border: '1px solid rgba(var(--ink-rgb),.10)',
          display: 'grid', placeItems: 'center',
          fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}
      >
        {c.authorInitial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{c.authorName}</span>
          <span
            style={{
              fontSize: 11, fontWeight: 700,
              padding: '2px 9px', borderRadius: 20,
              color: c.rankColor,
              border: `1px solid ${c.rankColor}`,
              background: 'rgba(var(--ink-rgb),.03)',
            }}
          >
            {c.authorRank}
          </span>
          <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{c.timeAr}</Num>
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-soft)', marginBottom: 9 }}>
          {c.bodyAr}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12.5, color: 'var(--muted2)' }}>
          <button
            type="button"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', color: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Icon name="favorite_border" size={14} /> <Num>{c.likes}</Num>
          </button>
          <button
            type="button"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', color: 'inherit',
            }}
          >
            رد
          </button>
        </div>

        {c.replies && c.replies.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {c.replies.map((r) => <CommentRow key={r.id} comment={r} depth={depth + 1} />)}
          </div>
        )}
      </div>
    </article>
  );
}
