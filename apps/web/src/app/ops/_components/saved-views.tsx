'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  addView,
  getDefaultView,
  loadColumnState,
  loadViews,
  newId,
  removeView,
  saveColumnState,
  setDefaultView,
  type SavedView,
} from '../_lib/views';

/**
 * OPS-360 Unit 2 — saved views dropdown. A view = the current URL querystring
 * (filters + sort + tab) plus the column layout of the screen's tables. Pure
 * client, localStorage-keyed by screen path (see _lib/views). No backend.
 *
 * Applying a view: pushes `path?query` (server re-renders with the filters) AND
 * writes the saved ColumnState back for each table key, then dispatches an
 * `ops:cols-changed` event so already-mounted DataTables re-read their layout
 * without a remount.
 *
 * Default view: if the screen is entered with an EMPTY querystring and a
 * default exists, it is auto-applied once per mount (that is what "default"
 * means); the operator can still clear filters afterwards without being pulled
 * back. One view per screen may hold the default flag.
 */

export const COLS_CHANGED_EVENT = 'ops:cols-changed';

export function SavedViews({
  /** Table keys whose column layout is part of a view on this screen. */
  tableKeys = [],
}: {
  tableKeys?: string[];
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const query = search.toString();

  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [asDefault, setAsDefault] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const autoAppliedRef = useRef(false);

  // Hydrate from localStorage after mount (SSR renders an empty control).
  useEffect(() => {
    setViews(loadViews(pathname));
  }, [pathname]);

  // Auto-apply the default view once, only on an empty-query landing.
  useEffect(() => {
    if (autoAppliedRef.current) return;
    autoAppliedRef.current = true;
    if (query) return;
    const def = getDefaultView(pathname);
    if (def && (def.query || Object.keys(def.columns).length)) {
      apply(def, /* replace */ true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setNaming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setNaming(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeName = useMemo(
    () => views.find((v) => v.query === query)?.name ?? null,
    [views, query],
  );

  function snapshotColumns(): SavedView['columns'] {
    const cols: SavedView['columns'] = {};
    for (const key of tableKeys) {
      const s = loadColumnState(key);
      if (s) cols[key] = s;
    }
    return cols;
  }

  function apply(view: SavedView, replace = false): void {
    // Restore column layouts and notify live tables.
    for (const [key, state] of Object.entries(view.columns)) {
      saveColumnState(key, state);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(COLS_CHANGED_EVENT, { detail: { tableKey: key } }));
      }
    }
    const url = view.query ? `${pathname}?${view.query}` : pathname;
    if (replace) router.replace(url);
    else router.push(url);
    setOpen(false);
  }

  function save(): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const view: SavedView = {
      id: newId(),
      name: trimmed,
      query,
      columns: snapshotColumns(),
      isDefault: asDefault,
      createdAt: Date.now(),
    };
    setViews(addView(pathname, view));
    setName('');
    setAsDefault(false);
    setNaming(false);
  }

  function remove(id: string): void {
    setViews(removeView(pathname, id));
  }

  function toggleDefault(id: string): void {
    const current = views.find((v) => v.id === id);
    setViews(setDefaultView(pathname, current?.isDefault ? null : id));
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]"
      >
        <span aria-hidden className="ml-1">☰</span>
        {activeName ? `العرض: ${activeName}` : 'العروض المحفوظة'}
      </button>

      {open ? (
        <div
          dir="rtl"
          role="menu"
          aria-label="العروض المحفوظة"
          className="absolute z-40 mt-1 w-72 rounded-lg border border-[#30363d] bg-[#161b22] p-2 text-[#e6edf3] shadow-lg"
          style={{ insetInlineStart: 0 }}
        >
          {views.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[#8b949e]">لا عروض محفوظة بعد.</p>
          ) : (
            <ul className="mb-1 max-h-64 space-y-0.5 overflow-y-auto">
              {views.map((v) => (
                <li key={v.id} className="flex items-center gap-1 rounded px-1 hover:bg-[#21262d]">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => apply(v)}
                    className="flex-1 truncate py-1.5 text-right text-sm"
                    title={v.query || '(بلا مرشحات)'}
                  >
                    {v.isDefault ? <span className="text-amber-400" aria-hidden>★ </span> : null}
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDefault(v.id)}
                    aria-label={v.isDefault ? `إلغاء افتراضية ${v.name}` : `جعل ${v.name} افتراضياً`}
                    title="تعيين كافتراضي"
                    className={`rounded px-1 text-sm ${v.isDefault ? 'text-amber-400' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
                  >
                    <span aria-hidden>{v.isDefault ? '★' : '☆'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    aria-label={`حذف ${v.name}`}
                    className="rounded px-1 text-sm text-[#8b949e] hover:text-red-300"
                  >
                    <span aria-hidden>✕</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[#30363d] pt-1.5">
            {naming ? (
              <div className="space-y-1.5 px-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') save();
                  }}
                  placeholder="اسم العرض"
                  aria-label="اسم العرض"
                  className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                />
                <label className="flex items-center gap-2 text-xs text-[#8b949e]">
                  <input
                    type="checkbox"
                    checked={asDefault}
                    onChange={(e) => setAsDefault(e.target.checked)}
                    className="h-3.5 w-3.5 accent-emerald-600"
                  />
                  جعله العرض الافتراضي لهذه الشاشة
                </label>
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNaming(false);
                      setName('');
                    }}
                    className="rounded border border-[#30363d] px-2 py-1 text-xs hover:bg-[#21262d]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!name.trim()}
                    className="rounded bg-[#238636] px-3 py-1 text-xs font-bold text-white hover:bg-[#2ea043] disabled:opacity-50"
                  >
                    حفظ
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className="w-full rounded px-2 py-1.5 text-right text-sm text-[#58a6ff] hover:bg-[#21262d]"
              >
                + حفظ العرض الحالي (المرشحات + الأعمدة)
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
