'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * Header bell. Polls /api/notifications/me every 60s; renders nothing on
 * 401 (anon) so it stays invisible until the user signs in. Click → mini
 * dropdown of the 5 most-recent notifications + a link to the full inbox.
 */

interface BellRow {
  id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface BellState {
  items: BellRow[];
  unreadCount: number;
}

const KIND_LABEL: Record<string, string> = {
  PLEDGE_RECEIVED: 'وصل دعم جديد',
  PROJECT_FUNDED: 'نجح مشروع',
  PROJECT_FAILED: 'لم يصل مشروع للهدف',
  MILESTONE_APPROVED: 'صرف مرحلة',
  PAYOUT_SENT: 'إرسال دفعة',
  UPDATE_POSTED: 'تحديث جديد',
  RANK_UP: 'رتبة جديدة',
  CONTEST_OPENED: 'جولة جديدة من علّق واربح',
  CONTEST_ANNOUNCED: 'نتائج جولة علّق واربح',
  FAQ_ANSWERED: 'ردّ على سؤالك',
  COMMENT_REPLY: 'ردّ على تعليقك',
};

function projectLabel(p: Record<string, unknown> | null): string {
  if (!p) return '';
  const t = typeof p.projectTitleAr === 'string' ? p.projectTitleAr : null;
  return t ? ` — ${t}` : '';
}

function relativeAr(iso: string): string {
  try {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (m < 1) return 'الآن';
    if (m < 60) return `قبل ${m} دقيقة`;
    const h = Math.round(m / 60);
    if (h < 24) return `قبل ${h} ساعة`;
    return `قبل ${Math.round(h / 24)} يوم`;
  } catch {
    return '';
  }
}

export function WathbaNotificationBell(): React.ReactElement | null {
  const [state, setState] = useState<BellState | null>(null);
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll every 60s. Single source of truth for the bell + dropdown.
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async (): Promise<void> => {
      try {
        const r = await fetch('/api/notifications/me?take=5', { credentials: 'include' });
        if (cancelled) return;
        if (r.status === 401) {
          setSignedIn(false);
          return;
        }
        if (!r.ok) return;
        const data = (await r.json()) as BellState;
        setSignedIn(true);
        setState(data);
      } catch {
        /* network blip — stay quiet */
      }
    };
    void fetchOnce();
    const t = setInterval(fetchOnce, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Click-outside dismiss.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (signedIn !== true) return null;

  const unread = state?.unreadCount ?? 0;
  const items = state?.items ?? [];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={unread > 0 ? `${unread} إشعار غير مقروء` : 'الإشعارات'}
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: 'pointer',
          width: 42,
          height: 42,
          borderRadius: 13,
          background: 'transparent',
          border: '1px solid rgba(var(--ink-rgb), .12)',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
        }}
      >
        <Icon name="notifications" size={21} color="var(--muted)" />
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 4,
              insetInlineEnd: 4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 10,
              fontWeight: 700,
              padding: '0 5px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg, #f4f6f1)',
              boxSizing: 'border-box',
            }}
          >
            {unread > 9 ? '٩+' : String(unread).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!)}
          </span>
        )}
      </button>

      {open && (
        <div
          dir="rtl"
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--surface, #fff)',
            border: '1px solid rgba(var(--ink-rgb), .12)',
            borderRadius: 14,
            boxShadow: 'var(--card-shadow-h, 0 16px 34px -14px rgba(18,33,26,.18))',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(var(--ink-rgb), .08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span>الإشعارات</span>
            {unread > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'rgba(var(--accent-rgb), .10)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(var(--accent-rgb), .30)',
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {unread} غير مقروء
              </span>
            )}
          </div>
          {items.length === 0 ? (
            <p style={{ padding: 18, fontSize: 13, color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
              لا توجد إشعارات بعد.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 360, overflowY: 'auto' }}>
              {items.map((n) => {
                const read = !!n.readAt;
                return (
                  <li
                    key={n.id}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid rgba(var(--ink-rgb), .05)',
                      background: read ? 'transparent' : 'rgba(var(--accent-rgb), .04)',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    {!read && (
                      <span
                        aria-hidden
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          marginTop: 7,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {KIND_LABEL[n.kind] ?? 'إشعار'}{projectLabel(n.payload)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                        {relativeAr(n.createdAt)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/projects/notifications"
            onClick={() => setOpen(false)}
            style={{
              display: 'block',
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--accent)',
              textAlign: 'center',
              textDecoration: 'none',
              borderTop: '1px solid rgba(var(--ink-rgb), .08)',
            }}
          >
            عرض كل الإشعارات
          </Link>
        </div>
      )}
    </div>
  );
}
