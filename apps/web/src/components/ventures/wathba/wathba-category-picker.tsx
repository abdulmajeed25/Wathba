'use client';

import { useEffect, useMemo, useState } from 'react';

import { Icon } from './wathba-icons';

/**
 * Batch CAT / Part 3 §4 — two-level, searchable, required category picker for
 * the launch wizard. Fetches the live tree (/api/categories); the user picks a
 * top-level then a subcategory. The chosen subcategory id is the canonical
 * `categoryId` sent to the API (which derives the legacy enum). Arabic-first.
 */

interface CatNode {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  children: CatNode[];
}

export function WathbaCategoryPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (id: string, label: string) => void;
}) {
  const [tree, setTree] = useState<CatNode[] | null>(null);
  const [topId, setTopId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/categories')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CatNode[] | null) => {
        if (alive && Array.isArray(d)) setTree(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // If a value is already set (edit flow), resolve which top-level owns it.
  useEffect(() => {
    if (!tree || !value || topId) return;
    for (const t of tree) {
      if (t.id === value || t.children.some((c) => c.id === value)) {
        setTopId(t.id);
        return;
      }
    }
  }, [tree, value, topId]);

  const top = useMemo(() => tree?.find((t) => t.id === topId) ?? null, [tree, topId]);

  const selectedLabel = useMemo(() => {
    if (!tree || !value) return null;
    for (const t of tree) {
      if (t.id === value) return t.nameAr;
      const c = t.children.find((x) => x.id === value);
      if (c) return `${t.nameAr} ← ${c.nameAr}`;
    }
    return null;
  }, [tree, value]);

  if (!tree) {
    return <div style={{ ...boxStyle, color: 'var(--muted2)' }}>جارٍ تحميل الفئات…</div>;
  }

  // Confirmed selection view.
  if (selectedLabel && value) {
    return (
      <div style={{ ...boxStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="category" size={18} color="var(--accent)" />
        <span style={{ fontWeight: 600, color: 'var(--text)' }} data-testid="picker-selected">
          {selectedLabel}
        </span>
        <button
          type="button"
          onClick={() => {
            onSelect('', '');
            setTopId(null);
            setQuery('');
          }}
          style={changeBtnStyle}
        >
          تغيير
        </button>
      </div>
    );
  }

  // Step 2 — subcategory of the chosen top-level.
  if (top) {
    const subs = top.children.filter((c) => c.nameAr.includes(query.trim()));
    return (
      <div style={boxStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button type="button" onClick={() => setTopId(null)} style={backBtnStyle}>
            <Icon name="chevron_left" size={16} color="var(--muted)" />
            رجوع
          </button>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{top.nameAr}</span>
        </div>
        <SearchBox query={query} setQuery={setQuery} placeholder="ابحث عن فئة فرعية…" />
        <div style={listStyle} role="listbox" aria-label="الفئات الفرعية">
          {subs.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={false}
              data-sub-slug={s.slug}
              onClick={() => onSelect(s.id, `${top.nameAr} ← ${s.nameAr}`)}
              style={optionStyle}
            >
              {s.nameAr}
            </button>
          ))}
          {subs.length === 0 && <div style={{ padding: 12, color: 'var(--muted2)', fontSize: 13 }}>لا نتائج</div>}
        </div>
      </div>
    );
  }

  // Step 1 — top-level.
  const tops = tree.filter((t) => t.nameAr.includes(query.trim()));
  return (
    <div style={boxStyle}>
      <SearchBox query={query} setQuery={setQuery} placeholder="ابحث عن فئة…" />
      <div style={listStyle} role="listbox" aria-label="الفئات">
        {tops.map((t) => (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={false}
            data-cat-slug={t.slug}
            onClick={() => {
              setTopId(t.id);
              setQuery('');
            }}
            style={{ ...optionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>{t.nameAr}</span>
            <Icon name="chevron_left" size={16} color="var(--muted2)" />
          </button>
        ))}
        {tops.length === 0 && <div style={{ padding: 12, color: 'var(--muted2)', fontSize: 13 }}>لا نتائج</div>}
      </div>
    </div>
  );
}

function SearchBox({
  query,
  setQuery,
  placeholder,
}: {
  query: string;
  setQuery: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '9px 12px',
          borderRadius: 10,
          border: '1px solid rgba(var(--ink-rgb),.12)',
          background: 'rgba(var(--ink-rgb),.04)',
          fontFamily: 'inherit',
          fontSize: 14,
          color: 'var(--text)',
        }}
      />
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  border: '1px solid rgba(var(--ink-rgb),.12)',
  borderRadius: 12,
  padding: 12,
  background: 'var(--card)',
};

const listStyle: React.CSSProperties = {
  maxHeight: 220,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const optionStyle: React.CSSProperties = {
  textAlign: 'start',
  padding: '9px 11px',
  borderRadius: 9,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 14,
  color: 'var(--text-soft)',
};

const changeBtnStyle: React.CSSProperties = {
  marginInlineStart: 'auto',
  background: 'transparent',
  border: '1px solid rgba(var(--ink-rgb),.14)',
  borderRadius: 9,
  padding: '5px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--accent)',
};

const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--muted)',
  padding: 0,
};
