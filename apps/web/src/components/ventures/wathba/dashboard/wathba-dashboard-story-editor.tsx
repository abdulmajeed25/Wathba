'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useUpload } from '@/lib/hooks/use-upload';

/**
 * Story block editor for the creator dashboard.
 *
 * Markup is intentionally minimal (a "Markdown-lite" subset) so the user
 * can write the story by typing and still get a TOC + media embeds:
 *
 *   # heading             → <h2> + auto-TOC entry
 *   ## subheading         → <h3> + auto-TOC entry
 *   - bullet              → <ul><li>
 *   1. ordered            → <ol><li>
 *   ![alt](url)           → <img>
 *   [youtube:VIDEO_ID]    → responsive YouTube embed
 *   plain text            → <p>, blank line = new paragraph
 *
 * No external editor library — the textarea IS the editor, and a live
 * preview pane on the side shows how it'll look on the public campaign
 * page. The TOC sidebar mirrors what the public Story tab renders.
 */
export function DashboardStoryEditor({
  projectId,
  initialStoryAr,
}: {
  projectId: string;
  initialStoryAr: string;
}): React.ReactElement {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress } = useUpload();

  const [storyAr, setStoryAr] = useState(initialStoryAr);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = storyAr !== initialStoryAr;
  const charCount = storyAr.length;
  const tooShort = charCount > 0 && charCount < 50;

  const toc = useMemo(() => extractHeadings(storyAr), [storyAr]);

  const insertAtCursor = useCallback(
    (snippet: string, opts: { lineStart?: boolean } = {}): void => {
      const el = textareaRef.current;
      if (!el) {
        setStoryAr((s) => s + snippet);
        return;
      }
      const start = el.selectionStart ?? storyAr.length;
      const end = el.selectionEnd ?? storyAr.length;
      let insert = snippet;
      let cursor = start + snippet.length;
      if (opts.lineStart) {
        // Make sure we're at column 0; prepend newline if not.
        const needsLead = start > 0 && storyAr[start - 1] !== '\n';
        if (needsLead) {
          insert = `\n${snippet}`;
          cursor = start + insert.length;
        }
      }
      const next = storyAr.slice(0, start) + insert + storyAr.slice(end);
      setStoryAr(next);
      // Restore focus + cursor after React renders.
      queueMicrotask(() => {
        el.focus();
        el.setSelectionRange(cursor, cursor);
      });
    },
    [storyAr],
  );

  const onPickImage = useCallback(async (): Promise<void> => {
    const input = fileInputRef.current;
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    const result = await upload(file, 'story');
    // Reset so picking the same file again still fires onChange.
    input.value = '';
    if (!result) {
      setError('فشل رفع الصورة، حاول مرة ثانية.');
      return;
    }
    const alt = file.name.replace(/\.[^.]+$/, '').slice(0, 60);
    insertAtCursor(`\n\n![${alt}](${result.publicUrl})\n\n`, { lineStart: true });
  }, [insertAtCursor, upload]);

  const save = useCallback(async (): Promise<void> => {
    if (storyAr.length > 0 && storyAr.length < 50) {
      setError('القصة لازم تكون 50 حرف على الأقل.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storyAr }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`فشل الحفظ (${res.status}): ${body.slice(0, 160)}`);
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [projectId, router, storyAr]);

  const reset = useCallback((): void => {
    if (!dirty) return;
    if (!confirm('تتراجع عن التعديلات اللي ما حفظتها؟')) return;
    setStoryAr(initialStoryAr);
    setError(null);
    setSavedAt(null);
  }, [dirty, initialStoryAr]);

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>القصة</h1>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-secondary, #3b4942)',
                margin: 0,
                maxWidth: 640,
              }}
            >
              اكتب قصة حملتك هنا. تقدر تضيف عناوين، صور، وفيديوهات يوتيوب. كل عنوان يصير تلقائياً
              مدخل في جدول المحتويات اللي يشوفه الزوار.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={reset} disabled={!dirty || busy} style={ghostBtnStyle}>
              تراجع
            </button>
            <button type="button" onClick={save} disabled={busy || !dirty} style={primaryBtnStyle}>
              {busy ? 'جارٍ الحفظ…' : 'حفظ القصة'}
            </button>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 10,
            fontSize: 12,
            color: 'var(--text-tertiary, #5d6b62)',
            flexWrap: 'wrap',
          }}
        >
          <span>{charCount.toLocaleString('en-US')} حرف</span>
          {tooShort && <span style={{ color: '#b91c1c' }}>الحد الأدنى 50 حرف</span>}
          {dirty && <span style={{ color: '#b45309' }}>• فيه تعديلات ما انحفظت</span>}
          {!dirty && savedAt !== null && (
            <span style={{ color: 'var(--brand-primary, #05a661)' }}>
              • انحفظت {timeAgo(savedAt)}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            color: '#b91c1c',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <Toolbar
        onInsert={insertAtCursor}
        onPickImage={(): void => fileInputRef.current?.click()}
        uploading={uploading}
        progress={progress}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onPickImage}
        style={{ display: 'none' }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 1fr',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <TocSidebar items={toc} />
        <EditorPane
          textareaRef={textareaRef}
          value={storyAr}
          onChange={(v): void => {
            setStoryAr(v);
            setSavedAt(null);
          }}
        />
        <PreviewPane source={storyAr} />
      </div>
    </>
  );
}

// ─────── Toolbar ─────────────────────────────────────────────────────────────

function Toolbar({
  onInsert,
  onPickImage,
  uploading,
  progress,
}: {
  onInsert: (snippet: string, opts?: { lineStart?: boolean }) => void;
  onPickImage: () => void;
  uploading: boolean;
  progress: number;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        padding: 10,
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
        borderRadius: 12,
        marginBottom: 12,
        alignItems: 'center',
      }}
    >
      <ToolBtn label="عنوان رئيسي" onClick={(): void => onInsert('# ', { lineStart: true })} />
      <ToolBtn label="عنوان فرعي" onClick={(): void => onInsert('## ', { lineStart: true })} />
      <ToolBtn label="قائمة نقطية" onClick={(): void => onInsert('- ', { lineStart: true })} />
      <ToolBtn label="قائمة مرقّمة" onClick={(): void => onInsert('1. ', { lineStart: true })} />
      <ToolBtn
        label="فيديو يوتيوب"
        onClick={(): void => {
          const raw = prompt('الصق رابط الفيديو أو معرّفه (مثل dQw4w9WgXcQ):');
          if (!raw) return;
          const id = extractYoutubeId(raw.trim());
          if (!id) {
            alert('ما قدرت أقرأ معرّف الفيديو من اللي لصقته.');
            return;
          }
          onInsert(`\n\n[youtube:${id}]\n\n`, { lineStart: true });
        }}
      />
      <ToolBtn
        label={uploading ? `جارٍ الرفع… ${progress}%` : 'رفع صورة'}
        disabled={uploading}
        onClick={onPickImage}
      />
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #5d6b62)' }}>
        تلميح: <code style={codeHint}>#</code> عنوان، <code style={codeHint}>-</code> نقطة،
        <code style={codeHint}>![نص](رابط)</code> صورة،
        <code style={codeHint}>[youtube:ID]</code> فيديو
      </div>
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 10px',
        background: 'transparent',
        border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
        borderRadius: 8,
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--text-primary, #16201b)',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

// ─────── Editor + Preview panes ──────────────────────────────────────────────

function EditorPane({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <div style={paneStyle}>
      <div style={paneHeader}>المحرّر</div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e): void => onChange(e.target.value)}
        rows={24}
        spellCheck={false}
        dir="auto"
        placeholder="ابدأ بكتابة قصتك… استخدم # للعناوين و- للنقاط."
        style={{
          width: '100%',
          minHeight: 480,
          padding: 14,
          border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
          borderRadius: 10,
          fontSize: 14,
          lineHeight: 1.7,
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
          background: 'var(--bg-base, #fff)',
          color: 'var(--text-primary, #16201b)',
          resize: 'vertical',
        }}
      />
    </div>
  );
}

function PreviewPane({ source }: { source: string }): React.ReactElement {
  const blocks = useMemo(() => parseBlocks(source), [source]);
  return (
    <div style={paneStyle}>
      <div style={paneHeader}>المعاينة</div>
      <div
        style={{
          padding: 16,
          background: 'var(--bg-base, #fff)',
          border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
          borderRadius: 10,
          minHeight: 480,
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--text-primary, #16201b)',
        }}
      >
        {blocks.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary, #5d6b62)', fontSize: 13 }}>
            المعاينة بتبان هنا لما تبدأ تكتب.
          </div>
        ) : (
          blocks.map((b, i) => renderBlock(b, i))
        )}
      </div>
    </div>
  );
}

// ─────── TOC sidebar ─────────────────────────────────────────────────────────

function TocSidebar({ items }: { items: HeadingItem[] }): React.ReactElement {
  return (
    <div style={{ ...paneStyle, position: 'sticky', top: 24 }}>
      <div style={paneHeader}>جدول المحتويات</div>
      <div
        style={{
          padding: 12,
          background: 'var(--bg-elevated, #fff)',
          border: '1px solid var(--border-subtle, rgba(18,33,26,0.08))',
          borderRadius: 10,
          fontSize: 13,
        }}
      >
        {items.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary, #5d6b62)' }}>
            أضف عنوان بـ <code style={codeHint}>#</code> لتشوفه هنا.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {items.map((h, idx) => (
              <li
                key={`${h.text}-${idx}`}
                style={{
                  paddingInlineStart: h.level === 3 ? 12 : 0,
                  color:
                    h.level === 2
                      ? 'var(--text-primary, #16201b)'
                      : 'var(--text-secondary, #3b4942)',
                  fontWeight: h.level === 2 ? 600 : 400,
                }}
              >
                {h.text || <em style={{ opacity: 0.6 }}>(بدون عنوان)</em>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────── Mini Markdown parser ────────────────────────────────────────────────

interface HeadingItem {
  level: 2 | 3;
  text: string;
}

type Block =
  | { kind: 'h2' | 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'img'; alt: string; url: string }
  | { kind: 'youtube'; id: string };

const YT_TOKEN_RE = /^\[youtube:([A-Za-z0-9_-]{6,20})\]$/;
const IMG_LINE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const YT_URL_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{6,20})/;

function extractHeadings(source: string): HeadingItem[] {
  const out: HeadingItem[] = [];
  for (const line of source.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('## ')) out.push({ level: 3, text: trimmed.slice(3).trim() });
    else if (trimmed.startsWith('# ')) out.push({ level: 2, text: trimmed.slice(2).trim() });
  }
  return out;
}

export function extractYoutubeId(input: string): string | null {
  // Accept either a raw ID, a watch URL, or a youtu.be URL.
  const rawIdMatch = /^[A-Za-z0-9_-]{6,20}$/.exec(input);
  if (rawIdMatch) return input;
  const m = YT_URL_RE.exec(input);
  return m && m[1] ? m[1] : null;
}

function parseBlocks(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];
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
      blocks.push({ kind: 'img', alt: img[1] ?? '', url: img[2] ?? '' });
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
  return blocks;
}

function renderBlock(b: Block, key: number): React.ReactElement {
  switch (b.kind) {
    case 'h2':
      return (
        <h2 key={key} style={{ fontSize: 22, fontWeight: 700, margin: '20px 0 8px' }}>
          {b.text}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={key} style={{ fontSize: 17, fontWeight: 700, margin: '14px 0 6px' }}>
          {b.text}
        </h3>
      );
    case 'p':
      return (
        <p key={key} style={{ margin: '8px 0' }}>
          {b.text}
        </p>
      );
    case 'ul':
      return (
        <ul key={key} style={{ margin: '8px 0', paddingInlineStart: 22 }}>
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} style={{ margin: '8px 0', paddingInlineStart: 22 }}>
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      );
    case 'img':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={b.url}
          alt={b.alt}
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 8,
            margin: '12px 0',
          }}
        />
      );
    case 'youtube':
      return (
        <div
          key={key}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            margin: '12px 0',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#000',
          }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${b.id}?rel=0`}
            title="فيديو يوتيوب"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
            }}
          />
        </div>
      );
  }
}

// ─────── Tiny helpers ────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `قبل ${s} ث`;
  const m = Math.round(s / 60);
  if (m < 60) return `قبل ${m} د`;
  return `قبل ${Math.round(m / 60)} س`;
}

// ─────── Shared visual atoms ─────────────────────────────────────────────────

const paneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
};

const paneHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-secondary, #3b4942)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'var(--brand-primary, #05a661)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'transparent',
  border: '1px solid var(--border-subtle, rgba(18,33,26,0.16))',
  borderRadius: 10,
  fontSize: 13,
  cursor: 'pointer',
  color: 'var(--text-secondary, #3b4942)',
  fontFamily: 'inherit',
  fontWeight: 600,
};

const codeHint: React.CSSProperties = {
  padding: '1px 5px',
  margin: '0 3px',
  background: 'var(--bg-base, rgba(18,33,26,0.06))',
  borderRadius: 4,
  fontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  fontSize: 11,
};
