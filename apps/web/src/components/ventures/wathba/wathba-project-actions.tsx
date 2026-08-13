'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * Batch ACCOUNT / U9 — «متابعة المشروع» and «حفظ», side by side and
 * deliberately not interchangeable.
 *
 * WHAT WAS HERE. One dead button. The rail rendered «ذكّرني» with a bell icon,
 * no onClick and no handler — a control that looked like a subscription and did
 * nothing — while saving existed only on discover cards. So the campaign page
 * offered no way to subscribe and no way to bookmark, and the affordance that
 * appeared to do the first was decoration.
 *
 * THE DISTINCTION IS THE FEATURE:
 *   follow (bell)     "tell me what happens" — updates, launch reminder,
 *                     48h-to-deadline, the funded/failed outcome.
 *   save   (bookmark) "read later" — private, and SILENT. It notifies nobody,
 *                     ever, and it is not a favourite or a like.
 *
 * They are visually distinct on purpose: follow is the wide control that fills
 * the row; save is the square secondary beside it. Two identical pills sitting
 * adjacent is how a reader learns they are the same thing, which they are not.
 *
 * INITIAL STATE IS FETCHED, not assumed. An earlier attempt rendered both as
 * "off" on every load, so a reader who already followed a project was invited
 * to follow it again and their click silently un-followed. /relations answers
 * both in one request.
 */

const SEEN_KEY = 'wathba.projectActions.tipsSeen';

interface Props {
  /** The DATABASE uuid — never the slug. See the resolver note in the BFF. */
  projectId: string;
}

export function WathbaProjectActions({ projectId }: Props) {
  const [following, setFollowing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'follow' | 'save' | null>(null);
  const [tip, setTip] = useState<'follow' | 'save' | null>(null);
  const seenRef = useRef(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) seenRef.current = true;
    } catch {
      // Private-mode browsers throw on access. A tooltip is not worth a crash;
      // treat it as already seen and stay quiet.
      seenRef.current = true;
    }
  }, []);

  // Both relations in one request. A signed-out reader gets 401 and the
  // controls stay off, which is the correct resting state for them.
  useEffect(() => {
    let alive = true;
    fetch(`/api/project-relations/${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : { following: false, saved: false }))
      .then((d: { following?: boolean; saved?: boolean }) => {
        if (!alive) return;
        setFollowing(Boolean(d.following));
        setSaved(Boolean(d.saved));
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => { alive = false; };
  }, [projectId]);

  function markSeen(): void {
    seenRef.current = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* see above */ }
  }

  function hint(which: 'follow' | 'save'): void {
    if (!seenRef.current) setTip(which);
  }

  async function toggle(kind: 'follow' | 'save'): Promise<void> {
    const isFollow = kind === 'follow';
    const now = isFollow ? following : saved;
    const next = !now;
    // Optimistic, with rollback — the control must answer the click at once,
    // and must never keep a state the server refused.
    if (isFollow) setFollowing(next); else setSaved(next);
    setBusy(kind);
    if (!seenRef.current) { setTip(kind); markSeen(); }
    try {
      const base = isFollow ? '/api/project-follows/' : '/api/bookmarks/';
      const res = await fetch(base + encodeURIComponent(projectId), {
        method: next ? 'POST' : 'DELETE',
      });
      if (res.status === 401) {
        window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      if (isFollow) setFollowing(now); else setSaved(now);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="wathba-proj-actions">
      <button
        type="button"
        onClick={() => toggle('follow')}
        onMouseEnter={() => hint('follow')}
        onFocus={() => hint('follow')}
        onMouseLeave={() => setTip(null)}
        onBlur={() => setTip(null)}
        aria-pressed={following}
        disabled={busy === 'follow' || !ready}
        className={following ? 'is-on' : undefined}
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
        disabled={busy === 'save' || !ready}
        className={`wathba-proj-save${saved ? ' is-on' : ''}`}
      >
        <Icon name="bookmark" size={16} />
      </button>

      {/* First use only. The explanation is for the reader meeting the pair for
          the first time; a tooltip that returns forever teaches nothing on the
          second encounter. */}
      {tip && (
        <span role="status" className="wathba-proj-tip">
          {tip === 'follow'
            ? 'المتابعة تُرسل لك تحديثات المشروع وتذكيراً قبل انتهاء الحملة.'
            : 'الحفظ للقراءة لاحقاً — خاص بك، وبلا إشعارات.'}
        </span>
      )}
    </div>
  );
}
