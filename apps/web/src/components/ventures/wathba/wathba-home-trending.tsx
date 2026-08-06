'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import type { deriveProject } from './wathba-data';
import { Icon, Num } from './wathba-icons';

/**
 * Batch RSC — «المشاريع الرائجة» with its four sort tabs.
 *
 * The tabs are the only reason this is client code. The section is lifted whole
 * rather than split, because the tab bar and the card grid share one piece of
 * state and sit in different wrappers — two components would have needed a
 * context or a lifted parent for what is one `useState`.
 */

type TrendTabId = 'hot' | 'new' | 'near' | 'big';

const TREND_TABS: { id: TrendTabId; label: string }[] = [
  { id: 'hot', label: 'الأكثر رواجاً' },
  { id: 'new', label: 'وصلت حديثاً' },
  { id: 'near', label: 'قاربت الاكتمال' },
  { id: 'big', label: 'الأكثر تمويلاً' },
];

export function WathbaHomeTrending({ list }: { list: ReturnType<typeof deriveProject>[] }) {
  const [trendTab, setTrendTab] = useState<TrendTabId>('hot');

  const trending = [...list];
  if (trendTab === 'hot') trending.sort((a, b) => b.backers - a.backers);
  else if (trendTab === 'new') trending.sort((a, b) => b.daysLeft - a.daysLeft);
  else if (trendTab === 'near')
    trending.sort((a, b) => (a.goal - a.raised) / a.goal - (b.goal - b.raised) / b.goal);
  else trending.sort((a, b) => b.raised - a.raised);

  return (
    <section style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 22,
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon name="trending_up" size={28} fill color="var(--accent)" />
            المشاريع الرائجة
          </h2>
          <p style={{ fontSize: 14, color: 'var(--muted2)', marginTop: 6 }}>
            أكثر المشاريع جذباً للداعمين هذا الأسبوع
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 9,
            background: 'rgba(var(--ink-rgb),.04)',
            border: '1px solid rgba(var(--ink-rgb),.08)',
            borderRadius: 13,
            padding: 5,
          }}
        >
          {TREND_TABS.map((t) => (
            <span
              key={t.id}
              onClick={() => setTrendTab(t.id)}
              style={{
                cursor: 'pointer',
                fontSize: 13.5,
                fontWeight: 600,
                padding: '8px 15px',
                borderRadius: 9,
                color: t.id === trendTab ? 'var(--on-accent)' : 'var(--muted)',
                background: t.id === trendTab ? 'var(--grad)' : 'transparent',
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        {trending.slice(0, 8).map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="wathba-pressable"
            style={{
              cursor: 'pointer',
              background: 'var(--card)',
              border: '1px solid rgba(var(--ink-rgb),.08)',
              borderRadius: 18,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--card-shadow)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            {/*
              HOME-REVIEW D1 — the card's cover.

              The height stays a FIXED 158px and the image is absolutely
              positioned inside it, so the box occupies its space before the
              image decodes. This page measures CLS 0.0012 across a full scroll
              and that number was worked for (preconnect + preload + fixed
              boxes); adding eight covers must not be what spends it.

              `.wathba-ph` is kept underneath as the fallback: the eight demo
              fixtures carry no imagery, so the hatched block still renders for
              them — it is now the exception it was always meant to be, not the
              default state of the platform's primary discovery grid.
            */}
            <div className="wathba-ph" style={{ height: 158, position: 'relative' }}>
              {p.coverUrl ? (
                <Image
                  src={p.coverUrl}
                  alt=""
                  fill
                  sizes="(max-width: 760px) 92vw, (max-width: 1100px) 45vw, 310px"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <Num style={{ fontSize: 11, color: 'var(--ph-label)' }}>[ {p.cat} ]</Num>
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  top: 11,
                  // Reading start: right in Arabic, left in English.
                  insetInlineStart: 11,
                  background: 'rgba(6,18,31,.8)',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(var(--ink-rgb),.12)',
                  color: 'var(--on-scrim)',
                  padding: '5px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {p.cat}
              </div>
              {/* bookmark — design line 313 (NOT a trust badge) */}
              <div
                style={{
                  position: 'absolute',
                  top: 11,
                  insetInlineEnd: 11,
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: 'rgba(6,18,31,.8)',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(var(--ink-rgb),.12)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name="bookmark" size={16} color="var(--on-scrim)" />
              </div>
              {/* §7 platform-partner — mandatory badge on the card */}
              {p.platformPartner && (
                <div
                  style={{
                    position: 'absolute',
                    insetInlineStart: 11,
                    bottom: 11,
                    background: 'rgba(var(--purple-rgb),.92)',
                    color: 'var(--on-accent)',
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Icon name="verified" size={12} color="var(--on-accent)" />
                  بشراكة وثبة
                </div>
              )}
            </div>
            <div
              style={{
                padding: '15px 16px 17px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
              }}
            >
              {/*
                Two lines, always. Real project titles are longer and less
                uniform than the demo fixtures this grid used to draw
                («سُمّار — أرشيف الحكاية الشعبية المسموعة» wraps; «سِرب — درون
                التصوير الذكي» does not), so a free-height title pushed each
                card's progress bar and meta row to a different baseline across
                the row. Reserving two lines re-aligns them without truncating
                the common case. lineHeight 1.45 is the RTL floor — Arabic
                ascenders and diacritics clip below it.
              */}
              <h3
                style={{
                  fontSize: 16.5,
                  fontWeight: 700,
                  marginBottom: 4,
                  lineHeight: 1.45,
                  minHeight: '2.9em',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {p.titleAr}
              </h3>
              {/*
                HOME-REVIEW D1 — the byline renders only when a creator name is
                actually known. The public project payload does not carry one,
                and this grid now draws REAL projects; printing «بواسطة » with
                nothing after it, or a fixture's name against a real project,
                would both be worse than omitting the line. The space is
                reclaimed rather than reserved, so cards stay flush.
              */}
              {p.creator ? (
                <div style={{ fontSize: 12.5, color: 'var(--muted2)', marginBottom: 13 }}>
                  بواسطة {p.creator}
                </div>
              ) : (
                <div style={{ marginBottom: 13 }} />
              )}
              <div style={{ marginTop: 'auto' }}>
                <div
                  style={{
                    height: 6,
                    borderRadius: 30,
                    background: 'rgba(var(--ink-rgb),.08)',
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{ height: '100%', width: p.pctW, background: p.barGrad, borderRadius: 30 }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Num style={{ fontSize: 15, fontWeight: 700, color: p.pctColor }}>{p.pct}%</Num>
                  <Num style={{ fontSize: 12.5, color: 'var(--muted2)' }}>{p.raisedFmt}</Num>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 8,
                    fontSize: 11.5,
                    color: 'var(--muted2)',
                  }}
                >
                  <Num>{p.backersFmt} داعم</Num>
                  <Num>{p.daysLeft} يوم</Num>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
