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
 * Now also supports a live API source (`apiComments`) — pinned-first ordering,
 * creator-badge, hidden-comment placeholders, and a "تحميل المزيد" CTA when
 * the API returns a next-cursor. When `apiComments` is omitted the component
 * falls back to the bundled RichComment fixture (legacy).
 *
 * Eligibility: posting requires a captured pledge; we surface a "فقط الداعمون
 * يمكنهم التعليق · سجّل الدخول" banner for anonymous viewers — but the list
 * itself stays public.
 */

const PAGE_SIZE = 12;

/** Shape returned by /v1/projects/:projectId/comments (Slice 2B). */
export interface ApiCommentRow {
  id: string;
  userId: string;
  userName: string;
  isCreator: boolean;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  bodyAr: string | null;
  parentId: string | null;
  date: string;
}

export function WathbaComments({
  projectId,
  comments,
  apiComments,
  initialCursor,
  isAuthenticated = false,
}: {
  projectId: string;
  comments: RichComment[];
  apiComments?: ApiCommentRow[];
  initialCursor?: string | null;
  isAuthenticated?: boolean;
}) {
  if (apiComments !== undefined) {
    return (
      <ApiCommentsList
        projectId={projectId}
        initial={apiComments}
        initialCursor={initialCursor ?? null}
        isAuthenticated={isAuthenticated}
      />
    );
  }
  return <FixtureCommentsList projectId={projectId} comments={comments} />;
}

/* -------------------------------------------------------------------------- */
/*  Live API list                                                             */
/* -------------------------------------------------------------------------- */

function ApiCommentsList({
  projectId,
  initial,
  initialCursor,
  isAuthenticated,
}: {
  projectId: string;
  initial: ApiCommentRow[];
  initialCursor: string | null;
  isAuthenticated: boolean;
}) {
  const [rows, setRows] = useState<ApiCommentRow[]>(initial);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);

  const loadMore = async (): Promise<void> => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/comments/${projectId}?cursor=${encodeURIComponent(cursor)}&take=25`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          items: ApiCommentRow[];
          nextCursor: string | null;
        };
        setRows((prev) => dedupeById([...prev, ...json.items]));
        setCursor(json.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  };

  // Pinned float to the top; the API already sorts that way but a client-side
  // safety sort keeps the order stable if the parent re-orders during paging.
  const ordered = useMemo(() => {
    const pinned = rows.filter((r) => r.pinned);
    const rest = rows.filter((r) => !r.pinned);
    return [...pinned, ...rest];
  }, [rows]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>التعليقات</h2>
        <Num style={{ fontSize: 13, color: 'var(--muted2)' }}>
          {rows.length.toLocaleString('en-US')} تعليقاً
        </Num>
      </div>

      {!isAuthenticated && <EligibilityBanner projectId={projectId} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {ordered.map((c) => (
          <ApiCommentRow key={c.id} comment={c} />
        ))}
      </div>

      {cursor && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <button
            type="button"
            onClick={() => {
              void loadMore();
            }}
            disabled={loading}
            style={{
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.10)',
              borderRadius: 11,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'progress' : 'pointer',
              color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'جاري التحميل…' : 'تحميل المزيد'}
          </button>
        </div>
      )}

      {!cursor && ordered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted2)', fontSize: 13 }}>
          لا توجد تعليقات بعد — كن أوّل من يعلّق.
        </div>
      )}
    </div>
  );
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function EligibilityBanner({ projectId }: { projectId: string }) {
  return (
    <Link
      href={`/sign-in?next=${encodeURIComponent(`/projects/${projectId}#comments`)}`}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--card)',
        border: '1px dashed rgba(var(--ink-rgb),.12)',
        borderRadius: 14,
        padding: '12px 14px',
        marginBottom: 22,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Icon name="lock" size={18} />
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--muted)' }}>
        فقط الداعمون يمكنهم التعليق · سجّل الدخول
      </span>
      <span
        style={{
          background: 'var(--grad)',
          color: 'var(--on-accent)',
          fontWeight: 700,
          fontSize: 12.5,
          padding: '6px 14px',
          borderRadius: 10,
        }}
      >
        تسجيل
      </span>
    </Link>
  );
}

function ApiCommentRow({ comment: c }: { comment: ApiCommentRow }) {
  const initial = c.userName?.trim().charAt(0).toUpperCase() || '·';
  const dateAr = formatDateAr(c.date);

  return (
    <article style={{ display: 'flex', gap: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: c.isCreator ? 'rgba(var(--accent-rgb),.10)' : 'var(--avatar)',
          color: c.isCreator ? 'var(--accent)' : 'var(--text)',
          border: '1px solid rgba(var(--ink-rgb),.10)',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{c.userName}</span>
          {c.isCreator && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 9px',
                borderRadius: 20,
                color: 'var(--accent)',
                border: '1px solid rgba(var(--accent-rgb),.5)',
                background: 'rgba(var(--accent-rgb),.08)',
              }}
            >
              الـمبدع
            </span>
          )}
          {c.pinned && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 9px',
                borderRadius: 20,
                color: 'var(--accent)',
                background: 'rgba(var(--accent-rgb),.10)',
              }}
            >
              📌 مثبَّت
            </span>
          )}
          <Num style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{dateAr}</Num>
        </div>

        {c.hidden ? (
          <p style={{ fontSize: 13.5, color: 'var(--muted2)', fontStyle: 'italic', marginBottom: 9 }}>
            تم إخفاء هذا التعليق
          </p>
        ) : (
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-soft)', marginBottom: 9 }}>
            {c.bodyAr}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12.5, color: 'var(--muted2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="favorite_border" size={14} /> <Num>{c.likeCount}</Num>
          </span>
        </div>
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

/* -------------------------------------------------------------------------- */
/*  Legacy fixture list (RichComment[])                                       */
/* -------------------------------------------------------------------------- */

function FixtureCommentsList({
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
