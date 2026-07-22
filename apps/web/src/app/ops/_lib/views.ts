'use client';

/**
 * OPS-360 Unit 2 — saved views + column state, both localStorage-backed and
 * PURELY client-side (no backend). A "view" is a named snapshot of a screen's
 * URL querystring (its filters/sort/tab) plus the visible-column layout of the
 * tables on that screen. Operators save the filter/column combos they use
 * daily and jump back to them; one view per screen may be flagged default and
 * is offered on entry.
 *
 * Storage layout (all keys namespaced under `ops:`, so clearing site data or a
 * PDPL wipe never touches server records — this is operator UI convenience,
 * nothing governed lives here):
 *   ops:views:<screenPath>   → SavedView[]   (named filter+column presets)
 *   ops:cols:<tableKey>      → ColumnState   (per-table show/hide + order)
 *
 * Everything is SSR-safe: reads guard `typeof window` and swallow malformed
 * JSON (a corrupt entry degrades to "no saved state", never a crash). A
 * follow-up could sync these to an operator-preferences endpoint so views roam
 * across devices — that is the ONLY part that would need a backend.
 */

export interface ColumnState {
  /** Full ordering of every known column key (the display order). */
  order: string[];
  /** Column keys the operator has hidden (subset of `order`). */
  hidden: string[];
}

export interface SavedView {
  id: string;
  name: string;
  /** URL querystring WITHOUT the leading «?» (filters + sort + tab). */
  query: string;
  /** Per-table column layout captured when the view was saved. */
  columns: Record<string, ColumnState>;
  isDefault: boolean;
  createdAt: number;
}

const VIEWS_PREFIX = 'ops:views:';
const COLS_PREFIX = 'ops:cols:';

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private-mode — views are best-effort convenience */
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ── Column state (per table key) ─────────────────────────────────────── */

export function loadColumnState(tableKey: string): ColumnState | null {
  return readJson<ColumnState>(COLS_PREFIX + tableKey);
}

export function saveColumnState(tableKey: string, state: ColumnState): void {
  writeJson(COLS_PREFIX + tableKey, state);
}

/**
 * Reconcile a persisted state against the columns the table actually declares
 * this render: keep the saved order for known keys, append newly-added columns
 * at the end, and drop stale keys. This makes the persistence resilient to a
 * screen adding/removing a column between deploys.
 */
export function reconcileColumnState(
  allKeys: string[],
  saved: ColumnState | null,
): ColumnState {
  if (!saved) return { order: [...allKeys], hidden: [] };
  const known = new Set(allKeys);
  const order = saved.order.filter((k) => known.has(k));
  for (const k of allKeys) if (!order.includes(k)) order.push(k);
  const hidden = saved.hidden.filter((k) => known.has(k));
  return { order, hidden };
}

/** Ordered list of visible column keys for the current state. */
export function visibleKeys(state: ColumnState): string[] {
  const hidden = new Set(state.hidden);
  return state.order.filter((k) => !hidden.has(k));
}

/* ── Saved views (per screen path) ────────────────────────────────────── */

export function loadViews(screenPath: string): SavedView[] {
  const v = readJson<SavedView[]>(VIEWS_PREFIX + screenPath);
  return Array.isArray(v) ? v : [];
}

export function saveViews(screenPath: string, views: SavedView[]): void {
  writeJson(VIEWS_PREFIX + screenPath, views);
}

export function addView(screenPath: string, view: SavedView): SavedView[] {
  const views = loadViews(screenPath);
  // A newly-flagged default demotes any prior default.
  const next = view.isDefault
    ? [...views.map((v) => ({ ...v, isDefault: false })), view]
    : [...views, view];
  saveViews(screenPath, next);
  return next;
}

export function removeView(screenPath: string, id: string): SavedView[] {
  const next = loadViews(screenPath).filter((v) => v.id !== id);
  saveViews(screenPath, next);
  return next;
}

export function setDefaultView(screenPath: string, id: string | null): SavedView[] {
  const next = loadViews(screenPath).map((v) => ({ ...v, isDefault: v.id === id }));
  saveViews(screenPath, next);
  return next;
}

export function getDefaultView(screenPath: string): SavedView | null {
  return loadViews(screenPath).find((v) => v.isDefault) ?? null;
}
