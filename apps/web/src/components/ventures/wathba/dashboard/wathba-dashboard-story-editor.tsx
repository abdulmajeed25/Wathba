'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useUpload } from '@/lib/hooks/use-upload';
import { parseStory, type StoryNode } from '@/lib/story/parse-story';
import { useConfirm } from '../wathba-feedback';

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
interface StoryChangeLogEntry {
  id: string;
  summaryAr: string;
  createdAt: string;
}

export function DashboardStoryEditor({
  projectId,
  initialStoryAr,
  projectStatus = 'DRAFT',
  changeLog = [],
}: {
  projectId: string;
  initialStoryAr: string;
  projectStatus?: string;
  changeLog?: StoryChangeLogEntry[];
}): React.ReactElement {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress } = useUpload();

  const [storyAr, setStoryAr] = useState(initialStoryAr);
  const confirmDlg = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // CC-11 — post-launch story edits are allowed but recorded in a public
  // change-log; the creator can attach a short note describing what changed.
  const postLaunch = projectStatus === 'LIVE' || projectStatus === 'PAUSED';
  const [changeNote, setChangeNote] = useState('');

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
      setError('فشل رفع الملف، حاول مرة ثانية.');
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
      // CC-11 — dedicated story endpoint allows post-launch edits (with a
      // public change-log entry); the general PATCH is locked once LIVE.
      const res = await fetch(`/api/projects/${projectId}/story`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          storyAr,
          ...(postLaunch && changeNote.trim() ? { changeNote: changeNote.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`فشل الحفظ (${res.status}): ${body.slice(0, 160)}`);
      }
      setSavedAt(Date.now());
      setChangeNote('');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [projectId, router, storyAr, postLaunch, changeNote]);

  const reset = useCallback(async (): Promise<void> => {
    if (!dirty) return;
    if (!(await confirmDlg({ title: 'تتراجع عن التعديلات؟', body: 'التعديلات غير المحفوظة ستضيع.', confirmLabel: 'تراجع', danger: true }))) return;
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
            <span style={{ color: 'var(--brand-ink, #047649)' }}>
              • انحفظت {timeAgo(savedAt)}
            </span>
          )}
        </div>
      </div>

      {/* CC-11 — post-launch edits are public. Offer a change note + show log. */}
      {postLaunch && (
        <div
          style={{
            marginBottom: 16, padding: '12px 14px', borderRadius: 10,
            border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.06)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#9a5a06', marginBottom: 6 }}>
            الحملة منشورة — أي تعديل على القصة يُسجَّل علناً للداعمين
          </div>
          <input
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="ملاحظة اختيارية: ما الذي تغيّر؟ (تظهر في سجل التعديلات)"
            aria-label="ملاحظة التغيير"
            maxLength={280}
            style={{
              width: '100%', padding: '9px 11px', borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit',
              border: '1px solid rgba(18,33,26,0.16)', background: 'var(--bg-base, #fff)', color: 'var(--text-primary, #16201b)',
            }}
          />
          {changeLog.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #3b4942)', marginBottom: 4 }}>
                سجل تعديلات القصة
              </div>
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, color: 'var(--text-secondary, #3b4942)', lineHeight: 1.7 }}>
                {changeLog.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    {c.summaryAr}{' '}
                    <span style={{ color: 'var(--text-tertiary, #5d6b62)' }}>
                      — {new Date(c.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
        accept="image/*,video/mp4,video/webm"
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
  const blocks = useMemo(() => parseStory(source), [source]);
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


function renderBlock(b: StoryNode, key: number): React.ReactElement | null {
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
        // Tailwind Preflight clears list-style, so the preview showed a
        // bulletless run of lines while the page draws markers.
        <ul key={key} style={{ margin: '8px 0', paddingInlineStart: 22, listStyleType: 'disc' }}>
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        // Tailwind Preflight clears list-style, so the preview showed a
        // bulletless run of lines while the page draws markers.
        <ol key={key} style={{ margin: '8px 0', paddingInlineStart: 22, listStyleType: 'decimal' }}>
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
    case 'video':
      // The preview shows what the page will show. Without this a creator who
      // drops in a clip sees nothing here and has no way to tell whether it
      // uploaded.
      return (
        <video
          key={key}
          src={b.url}
          controls
          preload="metadata"
          playsInline
          style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 10, background: '#000', display: 'block' }}
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
  color: 'var(--on-brand, #08130d)',
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
