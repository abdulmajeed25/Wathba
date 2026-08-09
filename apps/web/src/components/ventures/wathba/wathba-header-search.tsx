'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { SEARCH_CHIPS } from './wathba-search-chips';
import { Icon, Num } from './wathba-icons';

/**
 * Batch SEARCH Part 2 — the YouTube-style live search box (upgrades the
 * STAKES/L1 typeahead):
 *  - focus (empty): «عمليات بحثك الأخيرة» (localStorage, clearable) or the
 *    curated chips when there is no history
 *  - typing (debounced 200ms, ≥2 chars): grouped live results —
 *    مشاريع (thumb + title + creator + funded%) · مبدعون (avatar + name +
 *    project count) · فئات (→ its discover URL) — each row a real link,
 *    last row always «عرض كل النتائج عن …»
 *  - full combobox keyboard: ↑/↓ move, Enter opens the highlighted row
 *    (or /projects/search?q= when nothing is highlighted), Esc closes,
 *    Tab escapes; aria-activedescendant + role=combobox/listbox and an
 *    aria-live count announcement
 *  - `variant="sheet"`: the same combobox as a full-screen mobile sheet
 *  - the dropdown is absolutely positioned → zero layout shift
 */

interface SuggestProject {
  id: string;
  slug: string | null;
  titleAr: string;
  creatorName: string | null;
  fundedPct: number;
  imageUrl: string | null;
  status: string;
}
interface Suggestions {
  projects: SuggestProject[];
  creators: Array<{ id: string; name: string; handle: string | null; avatarUrl: string | null; projectsCount: number }>;
  categories: Array<{ slug: string; nameAr: string; parentSlug: string | null }>;
  /** Batch DISCOVERY-ENGINE — the curated tag vocabulary, reachable from here. */
  tags: Array<{ slug: string; nameAr: string; usageCount: number }>;
}

const EMPTY: Suggestions = { projects: [], creators: [], categories: [], tags: [] };

/** STAKES/S-15 (L2) — recent searches, localStorage, newest-first, max 5. */
const RECENT_KEY = 'wathba_recent_searches';
function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}
function pushRecent(q: string): void {
  try {
    const next = [q, ...readRecent().filter((x) => x !== q)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}
function clearRecent(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* storage unavailable */
  }
}

interface Option {
  key: string;
  href: string;
  group: 'مشاريع' | 'مبدعون' | 'فئات' | 'وسوم' | '';
  render: React.ReactNode;
}

export function WathbaHeaderSearch() {
  return (
    // minWidth:0 overrides a flex item's default `min-width:auto`, which pins
    // it at its content's min-content width (342px here). Without it this box
    // is the one element that claims to be flexible and then refuses to shrink,
    // and the row overflows onto the account control instead. The tier swap
    // below 1200px is the designed behaviour; this is the safety valve that
    // keeps the row from overflowing if anything beside it ever grows.
    <div className="wathba-wide-only" style={{ flex: 1, minWidth: 0, maxWidth: 380, position: 'relative' }}>
      <SearchCombobox variant="desktop" />
    </div>
  );
}

/**
 * Below 1200px the header cannot give the search FIELD enough width to type
 * into, so it holds this icon instead — it opens the same combobox full-screen,
 * so nothing is lost. Named "mobile" because it started there; it now covers
 * every width under the wide tier.
 */
export function WathbaMobileSearchButton({ style }: { style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="بحث"
        className="wathba-narrow-only"
        onClick={() => setOpen(true)}
        style={{ ...style, cursor: 'pointer', background: 'transparent', border: 'none' }}
      >
        <Icon name="search" size={20} color="var(--muted)" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="البحث"
          data-testid="mobile-search-sheet"
          style={{
            position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)',
            display: 'flex', flexDirection: 'column', padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <button
              type="button"
              aria-label="إغلاق البحث"
              onClick={() => setOpen(false)}
              style={{
                width: 38, height: 38, borderRadius: 11, border: '1px solid rgba(var(--ink-rgb),.14)',
                background: 'var(--card)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <Icon name="arrow_forward" size={18} color="var(--text)" />
            </button>
            <div style={{ flex: 1, position: 'relative' }}>
              <SearchCombobox variant="sheet" onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchCombobox({
  variant,
  onNavigate,
  onClose,
}: {
  variant: 'desktop' | 'sheet';
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(variant === 'sheet');
  const [sug, setSug] = useState<Suggestions>(EMPTY);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // ONE character, not two. The floor was 2, so the first keystroke of every
    // Arabic search returned nothing — and a single Arabic letter is far more
    // selective than a single Latin one, because the alphabet is larger and the
    // words are shorter. The server's prefix query makes it meaningful.
    if (q.trim().length < 1) {
      setSug(EMPTY);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .then((d: Suggestions) => {
          setSug({
            projects: d.projects ?? [], creators: d.creators ?? [],
            categories: d.categories ?? [], tags: d.tags ?? [],
          });
          setActive(-1);
        })
        .catch(() => setSug(EMPTY));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open, q]);

  useEffect(() => {
    if (!open || variant === 'sheet') return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, variant]);

  const typed = q.trim().length >= 2;

  const options: Option[] = useMemo(() => {
    if (!typed) return [];
    const out: Option[] = [];
    for (const p of sug.projects) {
      out.push({
        key: `prj-${p.id}`,
        href: p.slug ? `/p/${p.slug}` : `/projects/${p.id}`,
        group: 'مشاريع',
        render: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" width={42} height={42} style={{ borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span className="wathba-ph" style={{ width: 42, height: 42, borderRadius: 9, flexShrink: 0, display: 'block' }} />
            )}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.titleAr}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.creatorName ?? 'مبدع وثبة'} · <Num style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>{`${p.fundedPct}٪`}</Num>
              </span>
            </span>
          </span>
        ),
      });
    }
    for (const u of sug.creators) {
      out.push({
        key: `usr-${u.id}`,
        href: `/u/${encodeURIComponent(u.handle ?? u.id)}`,
        group: 'مبدعون',
        render: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {u.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatarUrl} alt="" width={34} height={34} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span
                style={{
                  width: 34, height: 34, borderRadius: '50%', background: 'var(--grad)',
                  color: 'var(--on-accent)', display: 'grid', placeItems: 'center',
                  fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}
              >
                {u.name.trim().charAt(0)}
              </span>
            )}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
              <Num style={{ display: 'block', fontSize: 11.5, color: 'var(--muted2)' }}>
                {`${u.projectsCount} ${u.projectsCount === 1 ? 'مشروع' : 'مشاريع'}`}
              </Num>
            </span>
          </span>
        ),
      });
    }
    for (const c of sug.categories) {
      out.push({
        key: `cat-${c.slug}`,
        href: c.parentSlug
          ? `/projects/discover/${c.parentSlug}/${c.slug}`
          : `/projects/discover/${c.slug}`,
        group: 'فئات',
        render: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 34, height: 34, borderRadius: 9, background: 'rgba(var(--accent-rgb),.10)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <Icon name="category" size={16} color="var(--accent)" />
            </span>
            <span style={{ fontWeight: 600 }}>{c.nameAr}</span>
          </span>
        ),
      });
    }
    // Batch DISCOVERY-ENGINE — tags, last. They are the broadest of the four
    // groups (a tag spans categories), so they read as "or widen to…" rather
    // than competing with the specific project the reader probably wants.
    for (const t of sug.tags) {
      out.push({
        key: `tag-${t.slug}`,
        href: `/projects/discover-all?tag=${encodeURIComponent(t.slug)}`,
        group: 'وسوم',
        render: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 34, height: 34, borderRadius: 9, background: 'rgba(var(--ink-rgb),.06)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <Icon name="bookmark" size={16} color="var(--muted2)" />
            </span>
            <span style={{ fontWeight: 600 }}>{t.nameAr}</span>
          </span>
        ),
      });
    }
    out.push({
      key: 'all',
      href: `/projects/search?q=${encodeURIComponent(q.trim())}`,
      group: '',
      render: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--accent-ink)' }}>
          <Icon name="search" size={15} color="var(--accent-ink)" />
          {`عرض كل النتائج عن «${q.trim()}» ←`}
        </span>
      ),
    });
    return out;
  }, [sug, typed, q]);

  const liveCount = sug.projects.length + sug.creators.length + sug.categories.length;

  const go = (href: string) => {
    if (q.trim().length >= 2) pushRecent(q.trim());
    setOpen(false);
    onNavigate?.();
    router.push(href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      onClose?.();
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = active >= 0 ? options[active] : null;
      if (target) go(target.href);
      else if (q.trim()) go(`/projects/search?q=${encodeURIComponent(q.trim())}`);
    }
    // Tab: no preventDefault — it escapes the combobox naturally.
  };

  const showRecent = open && !typed && recent.length > 0;
  const showChips = open && !typed && recent.length === 0;
  const showPanel = open && (typed || showRecent || showChips);
  const activeId = active >= 0 && options[active] ? `wathba-opt-${options[active].key}` : undefined;

  let lastGroup: string | null = null;

  return (
    <div ref={rootRef} style={{ position: 'relative' }} onKeyDown={onKey}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(var(--ink-rgb),.05)',
          border: '1px solid rgba(var(--ink-rgb),.09)',
          borderRadius: 13, padding: '10px 15px',
        }}
      >
        <Icon name="search" size={20} color="var(--muted2)" />
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="ابحث عن مشاريع، مبدعين، فئات…"
          aria-label="بحث"
          aria-expanded={showPanel}
          role="combobox"
          aria-controls="wathba-suggest"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoFocus={variant === 'sheet'}
          style={{
            // minWidth:0 — an <input>'s min-content width is its placeholder,
            // 280px here, and `flex:1` will not shrink past that by default. The
            // desktop field only ever gets 322px of the 1320 row, so the shell
            // was overflowing its own box by 4px at EVERY desktop width, and far
            // more as the viewport narrowed. With this the placeholder truncates
            // and the field simply gets narrower, which is what it looks like it
            // should do. The sheet variant is full-width and unaffected.
            flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
          }}
        />
      </div>
      {/* SR announcement of live result counts. */}
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
        {typed ? `${liveCount} نتيجة مقترحة` : ''}
      </span>
      {showPanel && (
        <div
          id="wathba-suggest"
          role="listbox"
          aria-label="اقتراحات البحث"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', insetInline: 0, zIndex: 70,
            background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.1)',
            borderRadius: 14, boxShadow: '0 30px 60px -24px rgba(0,0,0,.5)', padding: 6,
            maxHeight: variant === 'sheet' ? 'calc(100vh - 90px)' : 440, overflowY: 'auto',
          }}
        >
          {showRecent && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 11px 3px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted2)' }}>عمليات بحثك الأخيرة</span>
                <button
                  type="button"
                  onClick={() => { clearRecent(); setRecent([]); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--err)', fontFamily: 'inherit', padding: '2px 4px' }}
                >
                  مسح
                </button>
              </div>
              {recent.map((r) => (
                <Link
                  key={`recent-${r}`}
                  href={`/projects/search?q=${encodeURIComponent(r)}`}
                  role="option"
                  aria-selected={false}
                  onClick={() => { pushRecent(r); setOpen(false); onNavigate?.(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 10, textDecoration: 'none', color: 'var(--text)', fontSize: 13.5 }}
                >
                  <Icon name="history" size={15} color="var(--muted2)" /> {r}
                </Link>
              ))}
            </>
          )}
          {showChips && (
            <div style={{ padding: '7px 11px 9px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted2)', marginBottom: 8 }}>اقتراحات</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SEARCH_CHIPS.map((chip) => (
                  <Link
                    key={chip}
                    href={`/projects/search?q=${encodeURIComponent(chip)}`}
                    onClick={() => { pushRecent(chip); setOpen(false); onNavigate?.(); }}
                    style={{
                      fontSize: 12.5, fontWeight: 600, color: 'var(--text)', textDecoration: 'none',
                      border: '1px solid rgba(var(--ink-rgb),.14)', padding: '6px 13px', borderRadius: 999,
                    }}
                  >
                    {chip}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {typed && liveCount === 0 && (
            <div style={{ padding: '14px 11px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>لا نتائج — جرّب فئة أخرى</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SEARCH_CHIPS.map((chip) => (
                  <Link
                    key={chip}
                    href={`/projects/search?q=${encodeURIComponent(chip)}`}
                    onClick={() => { setOpen(false); onNavigate?.(); }}
                    style={{
                      fontSize: 12.5, fontWeight: 600, color: 'var(--text)', textDecoration: 'none',
                      border: '1px solid rgba(var(--ink-rgb),.14)', padding: '6px 13px', borderRadius: 999,
                    }}
                  >
                    {chip}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {typed &&
            options.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group || lastGroup;
              return (
                <div key={o.key}>
                  {header && (
                    // data-suggest-group so a test (or anything else) can target
                    // the HEADING rather than any row text that happens to
                    // contain the same word — a creator row reads «٣ مشاريع»,
                    // which collides with the «مشاريع» heading the moment the
                    // creator group is non-empty.
                    <div
                      data-suggest-group={header}
                      style={{ padding: '8px 11px 3px', fontSize: 11, fontWeight: 700, color: 'var(--muted2)' }}
                    >
                      {header}
                    </div>
                  )}
                  <Link
                    id={`wathba-opt-${o.key}`}
                    href={o.href}
                    role="option"
                    aria-selected={i === active}
                    onClick={() => { if (q.trim().length >= 2) pushRecent(q.trim()); setOpen(false); onNavigate?.(); }}
                    onMouseEnter={() => setActive(i)}
                    style={{
                      display: 'block', padding: '8px 11px', borderRadius: 10, textDecoration: 'none',
                      color: 'var(--text)', fontSize: 13.5,
                      background: i === active ? 'rgba(var(--accent-rgb),.10)' : 'transparent',
                    }}
                  >
                    {o.render}
                  </Link>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
