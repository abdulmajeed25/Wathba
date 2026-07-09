'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Icon, Num } from './wathba-icons';

/**
 * STAKES/L1 — the header search: a real input with a debounced typeahead
 * (projects + creators + categories in one round-trip). Enter or the
 * "عرض كل النتائج" row jumps to /projects/search?q=. Esc/outside-click
 * close; ↑/↓ + Enter navigate the flat option list (WCAG combobox-lite).
 */

interface Suggestions {
  projects: Array<{ id: string; titleAr: string; status: string }>;
  creators: Array<{ id: string; name: string; handle: string | null; avatarUrl: string | null }>;
  categories: Array<{ slug: string; nameAr: string; parentSlug: string | null }>;
}

const EMPTY: Suggestions = { projects: [], creators: [], categories: [] };

export function WathbaHeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sug, setSug] = useState<Suggestions>(EMPTY);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSug(EMPTY);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .then((d: Suggestions) => {
          setSug(d);
          setActive(-1);
        })
        .catch(() => setSug(EMPTY));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Flat option list for keyboard navigation (categories → creators → projects → all-results).
  const options: Array<{ key: string; href: string; label: string; kind: string }> = [
    ...sug.categories.map((c) => ({
      key: `cat-${c.slug}`,
      href: c.parentSlug
        ? `/projects/discover/${c.parentSlug}/${c.slug}`
        : `/projects/discover/${c.slug}`,
      label: c.nameAr,
      kind: 'فئة',
    })),
    ...sug.creators.map((u) => ({
      key: `usr-${u.id}`,
      href: `/u/${encodeURIComponent(u.handle ?? u.id)}`,
      label: u.name,
      kind: 'مبدع',
    })),
    ...sug.projects.map((p) => ({
      key: `prj-${p.id}`,
      href: `/projects/${p.id}`,
      label: p.titleAr,
      kind: 'مشروع',
    })),
    ...(q.trim().length >= 2
      ? [{ key: 'all', href: `/projects/search?q=${encodeURIComponent(q.trim())}`, label: `عرض كل النتائج عن «${q.trim()}»`, kind: '' }]
      : []),
  ];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = active >= 0 ? options[active] : null;
      if (target) go(target.href);
      else if (q.trim()) go(`/projects/search?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const showPanel = open && options.length > 0 && q.trim().length >= 2;

  return (
    <div
      ref={rootRef}
      className="wathba-desk-only"
      style={{ flex: 1, maxWidth: 380, position: 'relative' }}
      onKeyDown={onKey}
    >
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
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
          }}
        />
      </div>
      {showPanel && (
        <div
          id="wathba-suggest"
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', insetInline: 0, zIndex: 70,
            background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.1)',
            borderRadius: 14, boxShadow: '0 30px 60px -24px rgba(0,0,0,.5)', padding: 6,
            maxHeight: 420, overflowY: 'auto',
          }}
        >
          {options.map((o, i) => (
            <Link
              key={o.key}
              href={o.href}
              role="option"
              aria-selected={i === active}
              onClick={() => setOpen(false)}
              onMouseEnter={() => setActive(i)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '9px 11px', borderRadius: 10, textDecoration: 'none',
                color: 'var(--text)', fontSize: 13.5,
                background: i === active ? 'rgba(var(--accent-rgb),.10)' : 'transparent',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.label}
              </span>
              {o.kind && <Num style={{ fontSize: 11, color: 'var(--muted2)', flexShrink: 0 }}>{o.kind}</Num>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
