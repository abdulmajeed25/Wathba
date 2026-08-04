import Image from 'next/image';

import type { StoryNode } from '@/lib/story/parse-story';

import { Num } from './wathba-icons';

/**
 * Renders a creator's REAL story — the markdown they wrote in the dashboard —
 * on the public campaign page.
 *
 * Until this existed the page showed a hardcoded fixture and `storyAr` was
 * write-only: a creator could compose a story, upload images into it, save, and
 * never see any of it. The fixture is still the fallback for projects with no
 * story of their own (see wathba-tab-story), so demo campaigns keep their
 * designed copy.
 *
 * Typography matches the fixture renderer in wathba-story.tsx so the two are
 * indistinguishable in rhythm; only the source of the words differs.
 */
/** Heading id, stable for a given document so the TOC and the anchors agree. */
export const storyHeadingId = (i: number): string => `story-md-${i}`;

export function WathbaStoryMarkdown({ nodes }: { nodes: StoryNode[] }) {
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {nodes.map((n, i) => (
        <StoryNodeView key={i} node={n} index={i} />
      ))}
    </div>
  );
}


/**
 * Inline `**bold**`, the one inline mark this grammar supports.
 *
 * Block structure alone was enough while the only author was a campaign story,
 * but a rules page leans on emphasis to make a prohibition scannable — and a
 * creator typing `**مهم**` today gets literal asterisks, so this fixes the same
 * papercut on both surfaces. Split on the delimiter rather than parsing: odd
 * segments are the emphasised ones, and an unmatched `**` therefore stays
 * literal instead of swallowing the rest of the paragraph.
 */
function inline(text: string): React.ReactNode {
  const parts = text.split(/\*\*/);
  if (parts.length < 3) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

function StoryNodeView({ node: n, index }: { node: StoryNode; index: number }) {
  switch (n.kind) {
    case 'h2':
      return (
        <h2 id={storyHeadingId(index)} style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.4, scrollMarginTop: 100 }}>
          {inline(n.text)}
        </h2>
      );
    case 'h3':
      return (
        <h3 id={storyHeadingId(index)} style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4, scrollMarginTop: 100 }}>
          {inline(n.text)}
        </h3>
      );
    case 'p':
      return (
        <p style={{ fontSize: 16, lineHeight: 1.85, color: 'var(--text-soft)' }}>{inline(n.text)}</p>
      );
    case 'ul':
    case 'ol': {
      // Tailwind Preflight sets `list-style: none` on every ul/ol, so a native
      // marker never draws — the padding below would just reserve an empty
      // gutter. WathbaStory already solves this by painting its own marker into
      // that gutter with a logical inset; this matches it, and adds the ordered
      // case it never had. The number carries meaning in an ordered list, so it
      // cannot be dropped to a dot.
      const List = n.kind === 'ul' ? 'ul' : 'ol';
      return (
        <List style={{ paddingInlineStart: 22, display: 'grid', gap: 8 }}>
          {n.items.map((it, i) => (
            <li
              key={i}
              style={{
                fontSize: 16, lineHeight: 1.8, color: 'var(--text-soft)',
                listStyle: 'none', position: 'relative',
              }}
            >
              {n.kind === 'ul' ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', insetInlineEnd: 'calc(100% + 8px)', top: 10,
                    width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                  }}
                />
              ) : (
                <Num
                  decorative
                  style={{
                    position: 'absolute', insetInlineEnd: 'calc(100% + 8px)', top: 0,
                    fontSize: 14, fontWeight: 700, lineHeight: '29px', color: 'var(--accent)',
                  }}
                >
                  {i + 1}
                </Num>
              )}
              {inline(it)}
            </li>
          ))}
        </List>
      );
    }
    case 'img':
      return (
        <figure style={{ margin: 0 }}>
          {/* Height is intrinsic to the upload, so the box is sized by aspect
              ratio rather than a guess — a story image must not resize the
              article as it decodes. */}
          <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(var(--ink-rgb),.08)' }}>
            <Image src={n.url} alt={n.alt} fill sizes="(max-width: 760px) 92vw, 720px" style={{ objectFit: 'cover' }} />
          </div>
          {n.alt && (
            <figcaption style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 8, textAlign: 'center' }}>
              {n.alt}
            </figcaption>
          )}
        </figure>
      );
    case 'video':
      return (
        <figure style={{ margin: 0 }}>
          {/* `controls` and nothing else: no autoplay, no loop, no muted
              auto-start. A story video is content the reader chooses to watch,
              not decoration. preload="metadata" fetches the header for the
              duration and poster frame without pulling the whole file. */}
          <video
            src={n.url}
            controls
            preload="metadata"
            playsInline
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 16,
              border: '1px solid rgba(var(--ink-rgb),.08)',
              background: '#000',
              display: 'block',
            }}
          />
          {n.alt && (
            <figcaption style={{ fontSize: 12.5, color: 'var(--muted2)', marginTop: 8, textAlign: 'center' }}>
              {n.alt}
            </figcaption>
          )}
        </figure>
      );
    case 'youtube':
      return (
        <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden' }}>
          <iframe
            src={`https://www.youtube.com/embed/${n.id}`}
            title="فيديو المشروع"
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      );
  }
}
