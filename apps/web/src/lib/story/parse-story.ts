/**
 * The story markdown parser — ONE implementation, two consumers.
 *
 * It was written for the dashboard editor's live preview, where it was the only
 * thing that understood a creator's story. The public campaign page rendered a
 * hardcoded fixture instead and never read `storyAr` at all, so a story a
 * creator actually wrote — text, images, anything — was saved and then never
 * shown. Both surfaces parse with this now, so the preview cannot drift from
 * the page it is previewing.
 *
 * The grammar is deliberately small, and matches exactly what the editor's
 * toolbar emits: `#`/`##` headings, `-`/`*` and `1.` lists, `![alt](url)` media,
 * `[youtube:ID]`, and paragraphs from everything else.
 */

export type StoryNode =
  | { kind: 'h2' | 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'img'; alt: string; url: string }
  | { kind: 'video'; alt: string; url: string }
  | { kind: 'youtube'; id: string };

const YT_TOKEN_RE = /^\[youtube:([A-Za-z0-9_-]{6,20})\]$/;
const IMG_LINE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
/** Mirrors MIME_BY_KIND.story in the API: video/mp4 and video/webm. */
const VIDEO_EXT_RE = /\.(mp4|webm)(\?|#|$)/i;

export function parseStory(source: string): StoryNode[] {
  const lines = source.split('\n');
  const blocks: StoryNode[] = [];
  let para: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = (): void => {
    if (para.length > 0) {
      blocks.push({ kind: 'p', text: para.join(' ') });
      para = [];
    }
  };
  const flushList = (): void => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trimStart();

    if (trimmed.length === 0) {
      flushPara();
      flushList();
      continue;
    }

    // Headings.
    if (trimmed.startsWith('## ')) {
      flushPara();
      flushList();
      blocks.push({ kind: 'h3', text: trimmed.slice(3).trim() });
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushPara();
      flushList();
      blocks.push({ kind: 'h2', text: trimmed.slice(2).trim() });
      continue;
    }

    // Image (must be its own line).
    const img = IMG_LINE_RE.exec(trimmed);
    if (img) {
      flushPara();
      flushList();
      const url = img[2] ?? '';
      // Image syntax carries video too. The editor inserts `![alt](url)` for
      // whatever was uploaded, and the `story` upload kind accepts mp4/webm as
      // well as images — so the extension, not a second syntax, decides. A
      // creator who uploads a clip would otherwise get a permanently broken
      // <img>, which is what happened before this existed.
      blocks.push(
        VIDEO_EXT_RE.test(url)
          ? { kind: 'video', alt: img[1] ?? '', url }
          : { kind: 'img', alt: img[1] ?? '', url },
      );
      continue;
    }

    // YouTube token (must be its own line).
    const yt = YT_TOKEN_RE.exec(trimmed);
    if (yt && yt[1]) {
      flushPara();
      flushList();
      blocks.push({ kind: 'youtube', id: yt[1] });
      continue;
    }

    // Bullet list.
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushPara();
      if (!list || list.kind !== 'ul') {
        flushList();
        list = { kind: 'ul', items: [] };
      }
      list.items.push(trimmed.slice(2).trim());
      continue;
    }

    // Ordered list (e.g. "1. ", "12. ").
    const ol = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (ol) {
      flushPara();
      if (!list || list.kind !== 'ol') {
        flushList();
        list = { kind: 'ol', items: [] };
      }
      list.items.push((ol[2] ?? '').trim());
      continue;
    }

    // Default: paragraph line.
    flushList();
    para.push(trimmed);
  }

  flushPara();
  flushList();
  return normalizeHeadings(blocks);
}

/**
 * Lift the story's headings so its shallowest one is h2.
 *
 * The campaign page's own title is the h1 and the story sits under it, so `#`
 * maps to h2 and `##` to h3. A creator who uses only «عنوان فرعي» — a perfectly
 * reasonable thing to do when every section is a peer — therefore produced h3
 * directly beneath the h1, skipping a level. That is invisible on screen and
 * only shows up in the accessibility tree, where it tells a screen-reader user
 * there is a missing section above each heading.
 *
 * Relative structure is what matters, not which character was typed, so this
 * only shifts when there is nothing at the shallower level. A story using both
 * is untouched.
 */
function normalizeHeadings(blocks: StoryNode[]): StoryNode[] {
  const hasH2 = blocks.some((b) => b.kind === 'h2');
  if (hasH2) return blocks;
  return blocks.map((b) => (b.kind === 'h3' ? { kind: 'h2' as const, text: b.text } : b));
}
