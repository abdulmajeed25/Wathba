'use client';

import { useEffect, useId, useRef, useState } from 'react';

import type { ColumnState } from '../_lib/views';

/**
 * OPS-360 Unit 2 — the column-manager popover (gear icon). Show/hide columns
 * and reorder them; the parent (DataTable) owns persistence per table key.
 *
 * A11y: the gear is a real <button aria-haspopup aria-expanded>; the panel is
 * a labelled group; Esc closes and returns focus to the gear; an outside
 * click/pointerdown dismisses. Each column is a checkbox (visibility) with
 * up/down buttons (order) — all keyboard operable, no drag required. RTL: the
 * panel anchors to the inline-start edge and reorder arrows read top/bottom.
 */

export function ColumnManager({
  tableKey,
  columns,
  state,
  onChange,
}: {
  /** Identifies the table (for the label only; persistence is the parent's). */
  tableKey: string;
  /** All columns this table can show, in their declared order. */
  columns: Array<{ key: string; label: string }>;
  state: ColumnState;
  onChange: (next: ColumnState) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const labelOf = (k: string) => columns.find((c) => c.key === k)?.label ?? k;
  const hidden = new Set(state.hidden);
  const visibleCount = state.order.length - state.hidden.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        gearRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  function toggle(key: string) {
    const nextHidden = new Set(hidden);
    if (nextHidden.has(key)) nextHidden.delete(key);
    else if (visibleCount > 1) nextHidden.add(key); // never hide the last column
    onChange({ order: state.order, hidden: [...nextHidden] });
  }

  function move(key: string, dir: -1 | 1) {
    const order = [...state.order];
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const a = order[i]!;
    const b = order[j]!;
    order[i] = b;
    order[j] = a;
    onChange({ order, hidden: state.hidden });
  }

  function reset() {
    onChange({ order: columns.map((c) => c.key), hidden: [] });
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={gearRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="إدارة الأعمدة"
        className="rounded border border-[#30363d] bg-[#161b22] px-2.5 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d]"
      >
        <span aria-hidden>⚙︎</span>
        <span className="sr-only">إدارة الأعمدة</span>
      </button>

      {open ? (
        <div
          id={panelId}
          dir="rtl"
          role="group"
          aria-label={`أعمدة الجدول ${tableKey}`}
          className="absolute z-40 mt-1 w-64 rounded-lg border border-[#30363d] bg-[#161b22] p-2 text-[#e6edf3] shadow-lg"
          style={{ insetInlineStart: 0 }}
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#8b949e]">الأعمدة الظاهرة</span>
            <button
              type="button"
              onClick={reset}
              className="rounded px-1.5 py-0.5 text-[11px] text-[#58a6ff] hover:underline"
            >
              استعادة الافتراضي
            </button>
          </div>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {state.order.map((key, idx) => {
              const isVisible = !hidden.has(key);
              return (
                <li
                  key={key}
                  className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-[#21262d]"
                >
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggle(key)}
                      disabled={isVisible && visibleCount <= 1}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className={isVisible ? '' : 'text-[#8b949e]'}>{labelOf(key)}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => move(key, -1)}
                    disabled={idx === 0}
                    aria-label={`تحريك ${labelOf(key)} لأعلى`}
                    className="rounded px-1 text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-30"
                  >
                    <span aria-hidden>↑</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => move(key, 1)}
                    disabled={idx === state.order.length - 1}
                    aria-label={`تحريك ${labelOf(key)} لأسفل`}
                    className="rounded px-1 text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-30"
                  >
                    <span aria-hidden>↓</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
