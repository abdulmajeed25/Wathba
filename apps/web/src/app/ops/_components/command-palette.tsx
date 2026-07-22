'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { OPS_SECTIONS } from '../_lib/sections';
import { OpRunner, useFocusTrap } from './op-runner';

/**
 * OPS Part 5 / Phase B — Ctrl/⌘+K command palette. Arabic substring search
 * over the operator sections + the live operations manifest (fetched once,
 * lazily, on first open). Choosing a section navigates; choosing an operation
 * launches its <OpRunner> (dry-run → reason → execute) inline.
 *
 * Phase B adds JUMP-TO-RECORD: a pasted UUID offers deep links to open that
 * project / user / supplier directly, and any free-text query offers a
 * "search users/projects for ‹q›" deep link — so the palette is also the way
 * an operator reaches a specific record, not just a section. (Full server-side
 * entity search is a follow-up; this is the UUID + query-deeplink layer.)
 *
 * Fully keyboard-driven: ↑/↓ move, Enter selects, Esc closes; focus is trapped
 * within the panel and restored on close (WCAG 2.4.3 / 2.1.2).
 */

type RiskTier = 'CONTENT' | 'STANDARD' | 'SENSITIVE' | 'MONEY';

interface ManifestItem {
  key: string;
  titleAr: string;
  riskTier: RiskTier;
  requiresReason: boolean;
}

type Entry =
  | { kind: 'section'; id: string; labelAr: string; hintAr: string; href: string }
  | { kind: 'op'; id: string; labelAr: string; hintAr: string; op: ManifestItem }
  | { kind: 'jump'; id: string; labelAr: string; hintAr: string; href: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Build the jump-to-record entries for the current query (top of the list). */
function jumpEntries(raw: string): Entry[] {
  const q = raw.trim();
  if (q.length < 2) return [];
  if (UUID_RE.test(q)) {
    return [
      { kind: 'jump', id: `jump:project:${q}`, labelAr: 'افتح المشروع', hintAr: q, href: `/ops/projects/${q}` },
      { kind: 'jump', id: `jump:user:${q}`, labelAr: 'افتح المستخدم', hintAr: q, href: `/ops/users?q=${encodeURIComponent(q)}` },
      { kind: 'jump', id: `jump:supplier:${q}`, labelAr: 'افتح المورّد', hintAr: q, href: `/ops/suppliers/${q}` },
    ];
  }
  const enc = encodeURIComponent(q);
  return [
    { kind: 'jump', id: `jump:users:${q}`, labelAr: `ابحث عن مستخدم «${q}»`, hintAr: 'المستخدمون', href: `/ops/users?q=${enc}` },
    { kind: 'jump', id: `jump:projects:${q}`, labelAr: `ابحث عن مشروع «${q}»`, hintAr: 'المشاريع', href: `/ops/projects?q=${enc}` },
  ];
}

/** Normalise Arabic for forgiving matching (strip tashkeel, unify alef/ya). */
function norm(s: string): string {
  return s
    .replace(/[ً-ْ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [ops, setOps] = useState<ManifestItem[]>([]);
  const [pendingOp, setPendingOp] = useState<ManifestItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  // Trap + restore focus while the palette is open (WCAG 2.4.3 / 2.1.2).
  useFocusTrap(open, panelRef);

  // Global Ctrl/⌘+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lazy-load the manifest once, the first time the palette opens.
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      try {
        const r = await fetch('/api/ops/read/operations');
        if (r.ok) setOps(((await r.json()) as { items: ManifestItem[] }).items ?? []);
      } catch {
        /* palette still works over the sections */
      }
    })();
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const sections: Entry[] = OPS_SECTIONS.map((s) => ({
      kind: 'section',
      id: `sec:${s.href}`,
      labelAr: s.labelAr,
      hintAr: s.hintAr,
      href: s.href,
    }));
    const opEntries: Entry[] = ops.map((o) => ({
      kind: 'op',
      id: `op:${o.key}`,
      labelAr: o.titleAr,
      hintAr: o.key,
      op: o,
    }));
    const all = [...sections, ...opEntries];
    const q = norm(query);
    const filtered = !q ? all : all.filter((e) => norm(`${e.labelAr} ${e.hintAr}`).includes(q));
    // Known sections/ops rank first; the jump-to-record entries follow as an
    // "…or open/search this record" affordance. A pasted UUID matches no
    // section/op, so its deep links are then the only (top) results.
    return [...filtered, ...jumpEntries(query)];
  }, [ops, query]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, entries.length - 1)));
  }, [entries.length]);

  const choose = useCallback(
    (e: Entry) => {
      setOpen(false);
      if (e.kind === 'section' || e.kind === 'jump') {
        router.push(e.href);
      } else {
        setPendingOp(e.op);
      }
    },
    [router],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, entries.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const sel = entries[active];
        if (sel) choose(sel);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    },
    [entries, active, choose],
  );

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="لوحة الأوامر"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={panelRef}
            dir="rtl"
            className="w-full max-w-xl overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="قسم، عملية، أو معرّف سجل (UUID)… (Ctrl+K)"
              aria-label="ابحث في الأقسام والعمليات"
              className="w-full border-b border-[#30363d] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[#484f58]"
            />
            <ul role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
              {entries.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-[#8b949e]">لا نتائج مطابقة</li>
              ) : (
                entries.map((e, i) => (
                  <li key={e.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(e)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-right text-sm ${
                        i === active ? 'bg-[#21262d]' : 'hover:bg-[#1c2128]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            e.kind === 'section'
                              ? 'border border-[#30363d] text-[#8b949e]'
                              : e.kind === 'jump'
                                ? 'border border-emerald-500/40 text-emerald-300'
                                : e.op.riskTier === 'MONEY'
                                  ? 'border border-red-500/40 text-red-300'
                                  : e.op.riskTier === 'SENSITIVE'
                                    ? 'border border-amber-500/40 text-amber-300'
                                    : 'border border-sky-500/40 text-sky-300'
                          }`}
                        >
                          {e.kind === 'section' ? 'قسم' : e.kind === 'jump' ? 'انتقال' : e.op.riskTier}
                        </span>
                        {e.labelAr}
                      </span>
                      <span className="truncate text-[11px] text-[#484f58]" dir="ltr">
                        {e.hintAr}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {pendingOp ? (
        <OpRunner
          key={pendingOp.key}
          opKey={pendingOp.key}
          input={{}}
          triggerLabel={pendingOp.titleAr}
          riskTier={pendingOp.riskTier}
          requiresReason={pendingOp.requiresReason}
          autoStart
          onClose={() => setPendingOp(null)}
        />
      ) : null}
    </>
  );
}
