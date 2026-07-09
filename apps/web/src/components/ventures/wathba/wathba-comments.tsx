'use client';

import Image from 'next/image';
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
  /** STAKES/C10 — link the author to /u/[handle] + render the avatar. */
  userHandle?: string | null;
  userAvatarUrl?: string | null;
  isCreator: boolean;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  reportCount?: number;
  bodyAr: string | null;
  parentId: string | null;
  /** STAKES/K1 — non-null once the author edited within the window. */
  editedAt?: string | null;
  date: string;
}

export function WathbaComments({
  projectId,
  comments,
  apiComments,
  initialCursor,
  isAuthenticated = false,
  live = false,
}: {
  projectId: string;
  comments: RichComment[];
  apiComments?: ApiCommentRow[];
  initialCursor?: string | null;
  isAuthenticated?: boolean;
  /** STAKES/K1 — self-loading live mode for real projects: fetches the
   *  comment page + the viewer identity, enabling compose/edit/delete. */
  live?: boolean;
}) {
  if (live) return <LiveCommentsLoader projectId={projectId} />;
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

/** STAKES/K1 — fetches the first comments page + /api/me, then renders the
 *  live list with viewer-aware own-comment actions. */
function LiveCommentsLoader({ projectId }: { projectId: string }) {
  const [state, setState] = useState<{
    rows: ApiCommentRow[];
    cursor: string | null;
    viewerId: string | null;
    ready: boolean;
  }>({ rows: [], cursor: null, viewerId: null, ready: false });

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch(`/api/comments/${projectId}?take=25`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { items: [], nextCursor: null }))
        .catch(() => ({ items: [], nextCursor: null })),
      fetch('/api/me')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([page, me]: [{ items: ApiCommentRow[]; nextCursor: string | null }, { id: string } | null]) => {
      if (!alive) return;
      setState({ rows: page.items, cursor: page.nextCursor, viewerId: me?.id ?? null, ready: true });
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!state.ready) {
    return <div style={{ height: 120, borderRadius: 12, background: 'rgba(var(--ink-rgb),.04)' }} aria-hidden />;
  }
  return (
    <ApiCommentsList
      projectId={projectId}
      initial={state.rows}
      initialCursor={state.cursor}
      isAuthenticated={state.viewerId !== null}
      viewerId={state.viewerId}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Live API list                                                             */
/* -------------------------------------------------------------------------- */

function ApiCommentsList({
  projectId,
  initial,
  initialCursor,
  isAuthenticated,
  viewerId = null,
}: {
  projectId: string;
  initial: ApiCommentRow[];
  initialCursor: string | null;
  isAuthenticated: boolean;
  /** STAKES/K1 — enables edit/delete on the viewer's own comments. */
  viewerId?: string | null;
}) {
  const [rows, setRows] = useState<ApiCommentRow[]>(initial);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);

  const replaceRow = (updated: ApiCommentRow) =>
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  const dropRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const prependRow = (row: ApiCommentRow) => setRows((prev) => dedupeById([row, ...prev]));

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
      {isAuthenticated && <LiveComposeBox projectId={projectId} onPosted={prependRow} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {ordered.map((c) => (
          <ApiCommentRow
            key={c.id}
            comment={c}
            projectId={projectId}
            isAuthenticated={isAuthenticated}
            viewerId={viewerId}
            onEdited={replaceRow}
            onDeleted={dropRow}
          />
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

const EDIT_WINDOW_MS = 15 * 60 * 1000; // mirrors the API's STAKES/K1 window

function ApiCommentRow({
  comment: c,
  projectId,
  isAuthenticated,
  viewerId = null,
  onEdited,
  onDeleted,
}: {
  comment: ApiCommentRow;
  projectId: string;
  isAuthenticated: boolean;
  viewerId?: string | null;
  onEdited?: (row: ApiCommentRow) => void;
  onDeleted?: (id: string) => void;
}) {
  const initial = c.userName?.trim().charAt(0).toUpperCase() || '·';
  const dateAr = formatDateAr(c.date);
  const [reported, setReported] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.bodyAr ?? '');
  const [busy, setBusy] = useState(false);
  const report = async (): Promise<void> => {
    setReported(true); // optimistic
    try {
      await fetch(`/api/comments/${projectId}/${c.id}/report`, { method: 'POST' });
    } catch {
      /* keep the reported state; the API dedups anyway */
    }
  };

  // STAKES/K1 — own-comment actions; edit only inside the 15-min window.
  const isOwn = viewerId !== null && c.userId === viewerId;
  const editable = isOwn && !c.hidden && Date.now() - new Date(c.date).getTime() < EDIT_WINDOW_MS;

  const saveEdit = async (): Promise<void> => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${projectId}/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bodyAr: draft.trim() }),
      });
      if (res.ok) {
        onEdited?.((await res.json()) as ApiCommentRow);
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (busy) return;
    if (typeof window !== 'undefined' && !window.confirm('حذف هذا التعليق نهائياً؟')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/comments/${projectId}/${c.id}`, { method: 'DELETE' });
      if (res.ok) onDeleted?.(c.id);
    } finally {
      setBusy(false);
    }
  };

  // STAKES/C10 — every author name/avatar links to the public profile.
  const profileHref = `/u/${encodeURIComponent(c.userHandle ?? c.userId)}`;
  return (
    <article style={{ display: 'flex', gap: 12 }}>
      <Link
        href={profileHref}
        aria-label={`ملف ${c.userName}`}
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
          textDecoration: 'none',
          overflow: 'hidden',
        }}
      >
        {c.userAvatarUrl ? (
          /* STAKES/M2 — next/image: lazy + fixed dimensions (no CLS). */
          <Image src={c.userAvatarUrl} alt="" width={40} height={40} style={{ objectFit: 'cover' }} />
        ) : (
          initial
        )}
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
          <Link href={profileHref} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
            {c.userName}
          </Link>
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
              صاحب المشروع
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
        ) : editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 9 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={2000}
              aria-label="تعديل التعليق"
              style={{
                background: 'rgba(var(--ink-rgb),.04)', border: '1px solid rgba(var(--ink-rgb),.14)',
                borderRadius: 11, padding: '10px 12px', fontSize: 14, color: 'var(--text)',
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void saveEdit()} disabled={busy || !draft.trim()} style={{
                background: 'var(--grad)', color: 'var(--on-accent)', border: 'none',
                fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, padding: '8px 16px',
                borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
              }}>
                حفظ
              </button>
              <button type="button" onClick={() => { setEditing(false); setDraft(c.bodyAr ?? ''); }} style={{
                background: 'transparent', border: '1px solid rgba(var(--ink-rgb),.14)',
                color: 'var(--text-soft)', fontFamily: 'inherit', fontWeight: 600, fontSize: 12.5,
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
              }}>
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-soft)', marginBottom: 9 }}>
            {c.bodyAr}
            {c.editedAt && (
              <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}> (معدّل)</span>
            )}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12.5, color: 'var(--muted2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="favorite_border" size={14} /> <Num>{c.likeCount}</Num>
          </span>
          {/* STAKES/K1 — own-comment actions (edit inside the 15-min window). */}
          {editable && !editing && (
            <button type="button" onClick={() => setEditing(true)} style={inlineActionBtn}>
              ✏️ تعديل
            </button>
          )}
          {isOwn && !c.hidden && (
            <button type="button" onClick={() => void remove()} disabled={busy} style={{ ...inlineActionBtn, color: '#dc2626' }}>
              🗑 حذف
            </button>
          )}
          {/* CC-23 — report/flag a comment (logged-in, non-creator, not own). */}
          {isAuthenticated && !c.isCreator && !c.hidden && !isOwn && (
            <button
              type="button"
              onClick={() => void report()}
              disabled={reported}
              style={{
                background: 'transparent', border: 'none', cursor: reported ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, color: reported ? 'var(--muted2)' : 'inherit',
                padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              🚩 {reported ? 'تم الإبلاغ' : 'إبلاغ'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

const inlineActionBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12.5, color: 'inherit', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
};

/** STAKES/K1 — compose box for the live list (backers + the creator). */
function LiveComposeBox({
  projectId,
  onPosted,
}: {
  projectId: string;
  onPosted: (row: ApiCommentRow) => void;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (): Promise<void> => {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/comments/${projectId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bodyAr: body.trim() }),
      });
      const json = (await res.json().catch(() => null)) as
        | (ApiCommentRow & { message?: string })
        | null;
      if (res.ok && json) {
        onPosted(json);
        setBody('');
      } else if (res.status === 403) {
        setError('فقط داعمو المشروع يمكنهم التعليق — ادعم المشروع أولاً.');
      } else if (res.status === 429) {
        setError('تعليقات كثيرة خلال دقيقة — انتظر قليلاً ثم حاول مجدداً.');
      } else {
        setError(json?.message ?? 'تعذّر نشر التعليق — حاول مجدداً.');
      }
    } catch {
      setError('تعذّر الاتصال بالخادم.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="شارك رأيك أو سؤالك مع المجتمع…"
        aria-label="أضف تعليقاً"
        style={{
          background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.12)',
          borderRadius: 13, padding: '12px 14px', fontSize: 14, color: 'var(--text)',
          fontFamily: 'inherit', resize: 'vertical',
        }}
      />
      {error && (
        <span role="alert" style={{ fontSize: 12.5, color: '#dc2626' }}>{error}</span>
      )}
      <button type="button" onClick={() => void post()} disabled={busy || !body.trim()} style={{
        background: 'var(--grad)', color: 'var(--on-accent)', border: 'none',
        fontFamily: 'inherit', fontWeight: 700, fontSize: 13, padding: '10px 20px',
        borderRadius: 11, cursor: busy ? 'wait' : 'pointer', alignSelf: 'flex-start',
        opacity: busy || !body.trim() ? 0.6 : 1,
      }}>
        {busy ? 'جارٍ النشر…' : 'انشر التعليق'}
      </button>
    </div>
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
          {c.isCreatorReply && (
            <span
              style={{
                fontSize: 11, fontWeight: 700,
                padding: '2px 9px', borderRadius: 20,
                color: 'var(--accent)',
                border: '1px solid rgba(var(--accent-rgb),.5)',
                background: 'rgba(var(--accent-rgb),.08)',
              }}
            >
              صاحب المشروع
            </span>
          )}
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
