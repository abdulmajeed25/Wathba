'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * Batch ACCOUNT §3.5 — «متابعة المشروع» and «حفظ», side by side and
 * deliberately not interchangeable.
 *
 * These two controls used to be one dead button. The campaign rail rendered
 * «ذكّرني» with a bell icon, no onClick and no handler — a control that looked
 * like a subscription and did nothing — while saving existed only on discover
 * cards. So the campaign page offered no way to subscribe and no way to
 * bookmark, and the button that appeared to do the first was decoration.
 *
 * THE DISTINCTION IS THE FEATURE:
 *   · follow (bell)     = "tell me what happens" — updates, launch reminder,
 *                         48h-to-deadline, the funded/failed outcome.
 *   · save   (bookmark) = "read later" — private, and SILENT. It notifies
 *                         nobody, ever, and it is not a favourite or a like.
 *
 * They are visually distinct on purpose: the follow control is the wide one
 * that fills the row and changes colour when active; save is the square
 * secondary beside it. Two identical pills sitting adjacent is exactly how a
 * reader learns that they are the same thing, which they are not.
 *
 * FIRST-USE TOOLTIP. Shown once per control per browser, then never again —
 * the explanation is for the person meeting the pair for the first time, and a
 * tooltip that reappears forever is noise that teaches nothing on the second
 * encounter. Dismissal is remembered in localStorage; it is a preference, not
 * a record, so it does not belong on the account.
 */

const SEEN_KEY = 'wathba.projectActions.tipsSeen';

interface Props {
  projectId: string;
  initialFollowing?: boolean;
  initialSaved?: boolean;
  isAuthenticated?: boolean;
}

export function WathbaProjectActions({
  projectId,
  initialFollowing = false,
  initialSaved = false,
  isAuthenticated = true,
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState<'follow' | 'save' | null>(null);
  const [tip, setTip] = useState<'follow' | 'save' | null>(null);
  const seenRef = useRef(false);

  // First-use only. Reading in an effect (not during render) because
  // localStorage does not exist on the server and the two must not disagree.
  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) seenRef.current = true;
    } catch {
      // Private-mode browsers throw on access. A tooltip is not worth a crash;
      // treat it as "already seen" and stay quiet.
      seenRef.current = true;
    }
  }, []);

  function markSeen() {
    seenRef.current = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* see above */ }
  }

  function hint(which: 'follow' | 'save') {
    if (seenRef.current) return;
    setTip(which);
  }

  async function toggle(kind: 'follow' | 'save') {
    if (!isAuthenticated) {
      window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const isFollow = kind === 'follow';
    const now = isFollow ? following : saved;
    const next = !now;
    // Optimistic, with rollback — the control must answer the click at once,
    // and must not keep a state the server refused.
    if (isFollow) setFollowing(next); else setSaved(next);
    setBusy(kind);
    if (!seenRef.current) { setTip(kind); markSeen(); }
    try {
      const base = isFollow ? '/api/project-follows/' : '/api/bookmarks/';
      const res = await fetch(base + encodeURIComponent(projectId), { method: next ? 'POST' : 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      if (isFollow) setFollowing(now); else setSaved(now);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 8, marginBottom: 18 }}>
      <button
        type="button"
        onClick={() => toggle('follow')}
        onMouseEnter={() => hint('follow')}
        onFocus={() => hint('follow')}
        onMouseLeave={() => setTip(null)}
        onBlur={() => setTip(null)}
        aria-pressed={following}
        disabled={busy === 'follow'}
        style={{
          flex: 1, cursor: 'pointer', fontFamily: 'inherit',
          background: following ? 'rgba(var(--accent-rgb),.12)' : 'transparent',
          border: `1px solid ${following ? 'var(--accent)' : 'rgba(var(--ink-rgb),.16)'}`,
          color: following ? 'var(--accent-ink)' : 'var(--text)',
          fontWeight: 600, fontSize: 13, padding: '10px', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <Icon name="notifications" size={16} />
        {following ? 'أتابع المشروع' : 'متابعة المشروع'}
      </button>

      <button
        type="button"
        onClick={() => toggle('save')}
        onMouseEnter={() => hint('save')}
        onFocus={() => hint('save')}
        onMouseLeave={() => setTip(null)}
        onBlur={() => setTip(null)}
        aria-pressed={saved}
        aria-label={saved ? 'محفوظ' : 'حفظ'}
        disabled={busy === 'save'}
        style={{
          width: 44, cursor: 'pointer', fontFamily: 'inherit',
          background: saved ? 'rgba(var(--accent-rgb),.12)' : 'transparent',
          border: `1px solid ${saved ? 'var(--accent)' : 'rgba(var(--ink-rgb),.16)'}`,
          color: saved ? 'var(--accent-ink)' : 'var(--text)',
          borderRadius: 12, display: 'grid', placeItems: 'center',
        }}
      >
        <Icon name="bookmark" size={16} />
      </button>

      {tip && (
        <span
          role="status"
          style={{
            position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: 'calc(100% + 6px)',
            background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.12)',
            borderRadius: 10, padding: '8px 10px', fontSize: 12, lineHeight: 1.7,
            color: 'var(--muted2)', boxShadow: '0 12px 24px -12px rgba(0,0,0,.4)', zIndex: 5,
          }}
        >
          {tip === 'follow'
            ? 'المتابعة تُرسل لك تحديثات المشروع وتذكيراً قبل انتهاء الحملة.'
            : 'الحفظ للقراءة لاحقاً — خاص بك، وبلا إشعارات.'}
        </span>
      )}
    </div>
  );
}
