'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import type { ApiDiscoverCard } from '@/lib/api/wathba';
import { Icon, Num } from './wathba-icons';
import { toArabicDigits } from './discover-all-constants';

/**
 * Batch DISC — the Wathba discover card: cover, staff-pick badge, title,
 * days-left + funded%, and a bookmark toggle (optimistic; auth-gated at the
 * BFF → 401 rolls back).
 */
export function WathbaDiscoverAllCard({ p }: { p: ApiDiscoverCard }) {
  const [saved, setSaved] = useState(p.saved);
  const [busy, setBusy] = useState(false);

  const pct = p.fundingGoalHalalas > 0
    ? Math.round((p.raisedHalalas / p.fundingGoalHalalas) * 100)
    : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86_400_000));

  const toggle = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(`/api/bookmarks/${p.id}`, { method: next ? 'POST' : 'DELETE' });
      if (!res.ok) setSaved(!next); // rollback (401 = not signed in)
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link
      href={`/projects/${p.id}`}
      data-testid="discover-card"
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(var(--ink-rgb),.09)',
        borderRadius: 18,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        boxShadow: 'var(--card-shadow)',
        position: 'relative',
      }}
    >
      <div className="wathba-ph" style={{ height: 150, position: 'relative' }}>
        {/* The card's docstring has always said "cover", and the API has always
            sent mediaUrls — but nothing ever rendered it, so the discovery grid
            showed the bare hatch even for projects that had an image. The hatch
            stays as the ground beneath, which is what a project with no media
            still gets. Painted BEFORE the badges so they keep sitting on top. */}
        {p.mediaUrls[0] && (
          <Image
            src={p.mediaUrls[0]}
            alt=""
            fill
            loading="lazy"
            sizes="(max-width: 760px) 92vw, 320px"
            style={{ objectFit: 'cover' }}
          />
        )}
        {p.isStaffPick && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              insetInlineStart: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 9px',
              borderRadius: 9,
            }}
          >
            <Icon name="verified" size={13} color="var(--on-accent)" />
            مختارات وثبة
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={saved ? 'إزالة من المحفوظات' : 'حفظ المشروع'}
          aria-pressed={saved}
          data-testid="bookmark-toggle"
          style={{
            position: 'absolute',
            top: 10,
            insetInlineEnd: 10,
            width: 34,
            height: 34,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(var(--card-rgb,255,255,255),.9)',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 8px rgba(0,0,0,.15)',
          }}
        >
          <Icon name="bookmark" size={18} fill={saved} color={saved ? 'var(--accent)' : 'var(--muted)'} />
        </button>
        <div style={{ position: 'absolute', insetInline: 0, bottom: 0, height: 5, background: 'rgba(var(--ink-rgb),.12)' }}>
          <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: 'var(--grad)' }} />
        </div>
      </div>
      <div style={{ padding: '15px 16px 17px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, marginBottom: 6 }}>
          {p.titleAr}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted2)',
            marginBottom: 12,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {p.shortDescAr}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <Num style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>%{toArabicDigits(pct)}</Num>
          <span style={{ color: 'var(--muted2)' }}>مموَّل</span>
          <span style={{ color: 'var(--muted2)', marginInlineStart: 'auto' }}>
            {toArabicDigits(p.backersCount)} داعم · {toArabicDigits(daysLeft)} يوم متبقٍ
          </span>
        </div>
      </div>
    </Link>
  );
}
