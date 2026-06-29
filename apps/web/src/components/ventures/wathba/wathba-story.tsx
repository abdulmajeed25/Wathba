'use client';

import { useEffect, useMemo, useState } from 'react';

import type { StoryBlock } from './wathba-rich';
import { Icon, Num } from './wathba-icons';

/**
 * The long-form campaign story — Kickstarter-style stacked blocks scrolling
 * vertically. Supports headings, paragraphs, images (lazy-loaded with
 * placeholder), YouTube embeds, callouts, lists, and before/after compares.
 *
 * Pairs with WathbaStoryTOC below which auto-generates a sticky TOC from
 * the same blocks and tracks the active section via IntersectionObserver.
 */

const HERO_RATIO: Record<string, string> = {
  wide:   '16/9',
  square: '1/1',
  tall:   '3/4',
};

export function WathbaStory({ blocks }: { blocks: StoryBlock[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {blocks.map((b, i) => <StoryBlockNode key={i} block={b} />)}
    </div>
  );
}

function StoryBlockNode({ block: b }: { block: StoryBlock }) {
  switch (b.kind) {
    case 'h2':
      return (
        <h2
          id={`story-${b.id}`}
          style={{
            fontSize: 28, fontWeight: 700, letterSpacing: '-.5px',
            marginTop: 14, scrollMarginTop: 100,
          }}
        >
          {b.text}
        </h2>
      );
    case 'h3':
      return (
        <h3
          id={`story-${b.id}`}
          style={{
            fontSize: 20, fontWeight: 700,
            marginTop: 6, scrollMarginTop: 100,
          }}
        >
          {b.text}
        </h3>
      );
    case 'p':
      return (
        <p style={{ fontSize: 16, lineHeight: 1.85, color: 'var(--text-soft)' }}>
          {b.text}
        </p>
      );
    case 'img':
      return (
        <figure style={{ margin: 0 }}>
          <div
            className="wathba-ph"
            style={{
              aspectRatio: HERO_RATIO[b.ratio ?? 'wide'],
              borderRadius: 16,
              border: '1px solid rgba(var(--ink-rgb),.08)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <Num style={{ fontSize: 11, color: 'var(--ph-label)' }}>[ {b.alt} ]</Num>
          </div>
          {b.caption && (
            <figcaption style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 8, textAlign: 'center' }}>
              {b.caption}
            </figcaption>
          )}
        </figure>
      );
    case 'video':
    case 'embed':
      return <YouTubeBlock videoId={b.videoId} caption={b.kind === 'video' ? b.caption : undefined} />;
    case 'list':
      return (
        <ul style={{ paddingInlineStart: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {b.items.map((it, i) => (
            <li
              key={i}
              style={{
                fontSize: 15.5, lineHeight: 1.7, color: 'var(--text-soft)',
                listStyle: 'none', position: 'relative',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute', insetInlineEnd: 'calc(100% + 8px)', top: 8,
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                }}
              />
              {it}
            </li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <div
          style={{
            background: 'rgba(var(--accent-rgb),.06)',
            border: '1px solid rgba(var(--accent-rgb),.22)',
            borderRadius: 14, padding: 18,
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}
        >
          <Icon name={b.icon ?? 'lightbulb'} size={22} color="var(--accent)" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{b.title}</div>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-soft)' }}>{b.body}</p>
          </div>
        </div>
      );
    case 'compare':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <CompareCol label="قبل" body={b.before} tone="muted" />
          <CompareCol label="بعد" body={b.after} tone="accent" />
        </div>
      );
  }
}

function CompareCol({ label, body, tone }: { label: string; body: string; tone: 'muted' | 'accent' }) {
  const accent = tone === 'accent';
  return (
    <div
      style={{
        background: accent ? 'rgba(var(--accent-rgb),.05)' : 'rgba(var(--ink-rgb),.04)',
        border: `1px solid ${accent ? 'rgba(var(--accent-rgb),.18)' : 'rgba(var(--ink-rgb),.10)'}`,
        borderRadius: 12, padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1,
          color: accent ? 'var(--accent)' : 'var(--muted2)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-soft)' }}>{body}</div>
    </div>
  );
}

function YouTubeBlock({ videoId, caption }: { videoId: string; caption?: string }) {
  // Click-to-load pattern (no iframe until the user clicks) so dozens of
  // embedded videos in a long story don't blow up first-paint.
  const [loaded, setLoaded] = useState(false);
  return (
    <figure style={{ margin: 0 }}>
      {loaded ? (
        <div style={{ aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title="فيديو المشروع"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label="تشغيل الفيديو"
          style={{
            position: 'relative', cursor: 'pointer', width: '100%',
            aspectRatio: '16/9', border: 'none',
            background: `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg) center/cover, var(--ph-bg)`,
            borderRadius: 16,
            display: 'grid', placeItems: 'center',
            fontFamily: 'inherit',
          }}
        >
          <span
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(0,0,0,.7)',
              color: 'white', fontSize: 28,
              display: 'grid', placeItems: 'center',
            }}
          >
            ▶
          </span>
        </button>
      )}
      {caption && (
        <figcaption style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 8, textAlign: 'center' }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/* ───────────────────────────── TOC ─────────────────────────────────────── */

export function WathbaStoryTOC({ blocks }: { blocks: StoryBlock[] }) {
  const headings = useMemo(
    () =>
      blocks
        .filter((b): b is Extract<StoryBlock, { kind: 'h2' | 'h3' }> => b.kind === 'h2' || b.kind === 'h3')
        .map((h) => ({ id: `story-${h.id}`, text: h.text, depth: h.kind === 'h2' ? 1 : 2 })),
    [blocks],
  );
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el != null);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // active = the highest visible heading (smallest top y > 0)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: [0, 1] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [headings]);

  if (headings.length < 3) return null;
  return (
    <nav
      aria-label="فهرس القصة"
      style={{ position: 'sticky', top: 96, fontSize: 13, lineHeight: 1.5 }}
    >
      <div
        style={{
          fontSize: 12, fontWeight: 700, color: 'var(--muted2)',
          letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase',
        }}
      >
        المحتويات
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {headings.map((h) => {
          const isActive = active === h.id;
          return (
            <li
              key={h.id}
              style={{
                marginBottom: 6,
                borderInlineStart: `2px solid ${isActive ? 'var(--accent)' : 'rgba(var(--ink-rgb),.08)'}`,
                paddingInlineStart: h.depth === 2 ? 22 : 10,
              }}
            >
              <a
                href={`#${h.id}`}
                style={{
                  display: 'block', padding: '4px 0',
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  textDecoration: 'none',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: h.depth === 2 ? 12.5 : 13.5,
                  transition: 'color .2s',
                }}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
