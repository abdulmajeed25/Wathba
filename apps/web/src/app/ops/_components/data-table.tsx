'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { CsvExport } from './csv-export';
import { ColumnManager } from './column-manager';
import { SavedViews, COLS_CHANGED_EVENT } from './saved-views';
import type { CsvColumn } from '../_lib/csv';
import {
  loadColumnState,
  reconcileColumnState,
  saveColumnState,
  visibleKeys,
  type ColumnState,
} from '../_lib/views';

/**
 * OPS Part 5 + OPS-360 Unit 2 — the reusable server-data table. Data is always
 * fetched in a server component; this island only renders it (and, optionally,
 * drives multi-select for bulk actions). Styling mirrors «سجل التدقيق»:
 * overflow-x-auto, min-w, thead bg #161b22 text-right, tbody divide-y.
 *
 * Unit 2 additions (all opt-in — existing callers are unchanged):
 *  • `tableKey` → a gear popover (<ColumnManager>) to show/hide + reorder
 *    columns, persisted per table key in localStorage; live-reloads on the
 *    `ops:cols-changed` event a saved-view apply dispatches.
 *  • Sortable headers → click (or Enter/Space) cycles asc→desc→none. This sorts
 *    the CURRENT PAGE client-side; true cross-cursor server sort is a FOLLOW-UP
 *    (needs a `sort=` param + ordered read endpoint).
 *  • `csvFileName` → a <CsvExport> button that exports the visible columns of
 *    the current page (PDPL-masked, no re-fetch).
 *  • `savedViews` → a <SavedViews> dropdown (filters + column layout presets).
 *  • `bulk` → a render slot below the table, given the selected rows + a
 *    `clear()`, so a <BulkBar> replaces per-row OpRunners.
 */

export interface Column<Row> {
  key: string;
  label: string;
  align?: 'right' | 'left' | 'center';
  /** Custom cell renderer; defaults to `String(row[key])`. */
  render?: (row: Row) => ReactNode;
  /** Plain-text value for CSV export + default sort (money → its SAR string). */
  csv?: (row: Row) => string;
  /** Enable client-side sort on this column's header. */
  sortable?: boolean;
  /** Sort key; defaults to csv() then String(row[key]). */
  sortValue?: (row: Row) => string | number;
}

type SortDir = 'asc' | 'desc';

function cellText<Row>(c: Column<Row>, row: Row): string {
  if (c.csv) return c.csv(row);
  const v = (row as Record<string, unknown>)[c.key];
  return v === null || v === undefined ? '' : String(v);
}

export function DataTable<Row extends { id: string }>({
  columns,
  rows,
  emptyAr,
  minWidth = 700,
  selectable = false,
  onSelectionChange,
  onRowActivate,
  tableKey,
  savedViews = false,
  csvFileName,
  csvLabelAr,
  toolbar,
  bulk,
}: {
  columns: Column<Row>[];
  rows: Row[];
  emptyAr: string;
  minWidth?: number;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  onRowActivate?: (row: Row) => void;
  /** Enables column show/hide + reorder, persisted under this key. */
  tableKey?: string;
  /** Render a <SavedViews> control in the toolbar (keyed to this table). */
  savedViews?: boolean;
  /** Render a <CsvExport> button; this is the base filename. */
  csvFileName?: string;
  csvLabelAr?: string;
  /** Extra toolbar content (rendered at the inline-start of the toolbar row). */
  toolbar?: ReactNode;
  /** Bulk-action slot rendered below the table when a selection exists. */
  bulk?: (ctx: { rows: Row[]; ids: string[]; clear: () => void }) => ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);

  const allKeys = useMemo(() => columns.map((c) => c.key), [columns]);

  // Column state (order + hidden). Only meaningful when `tableKey` is set;
  // otherwise the declared column order is used verbatim.
  const [colState, setColState] = useState<ColumnState>(() => ({ order: allKeys, hidden: [] }));

  // Hydrate persisted column state after mount (SSR renders declared order).
  useEffect(() => {
    if (!tableKey) {
      setColState({ order: allKeys, hidden: [] });
      return;
    }
    setColState(reconcileColumnState(allKeys, loadColumnState(tableKey)));
  }, [tableKey, allKeys]);

  // Live-reload when a saved-view apply rewrites this table's column layout.
  useEffect(() => {
    if (!tableKey) return;
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ tableKey?: string }>).detail;
      if (detail?.tableKey === tableKey) {
        setColState(reconcileColumnState(allKeys, loadColumnState(tableKey)));
      }
    };
    window.addEventListener(COLS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(COLS_CHANGED_EVENT, onChanged);
  }, [tableKey, allKeys]);

  const updateColState = useCallback(
    (next: ColumnState) => {
      setColState(next);
      if (tableKey) saveColumnState(tableKey, next);
    },
    [tableKey],
  );

  // Drop selections that no longer exist when the server data changes.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  useEffect(() => {
    onSelectionChange?.([...selected]);
  }, [selected, onSelectionChange]);

  // The columns actually rendered: reordered + visibility-filtered.
  const shownColumns = useMemo(() => {
    if (!tableKey) return columns;
    const byKey = new Map(columns.map((c) => [c.key, c] as const));
    return visibleKeys(colState)
      .map((k) => byKey.get(k))
      .filter((c): c is Column<Row> => !!c);
  }, [columns, colState, tableKey]);

  // Client-side sort of the current page.
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = (r: Row): string | number =>
      col.sortValue ? col.sortValue(r) : cellText(col, r);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ar') * dir;
    });
  }, [rows, sort, columns]);

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function cycleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  const align = (a?: Column<Row>['align']) =>
    a === 'left' ? 'text-left' : a === 'center' ? 'text-center' : 'text-right';

  const colCount = shownColumns.length + (selectable ? 1 : 0);

  const csvColumns: CsvColumn<Row>[] = shownColumns.map((c) => ({
    label: c.label,
    cell: (r) => cellText(c, r),
  }));

  const hasToolbar = !!(tableKey || savedViews || csvFileName || toolbar);
  const selectedRows = rows.filter((r) => selected.has(r.id));

  return (
    <div className="space-y-3">
      {hasToolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {savedViews ? <SavedViews tableKeys={tableKey ? [tableKey] : []} /> : null}
            {csvFileName ? (
              <CsvExport
                columns={csvColumns}
                rows={sortedRows}
                filename={csvFileName}
                labelAr={csvLabelAr}
              />
            ) : null}
            {tableKey ? (
              <ColumnManager
                tableKey={tableKey}
                columns={columns.map((c) => ({ key: c.key, label: c.label }))}
                state={colState}
                onChange={updateColState}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-[#21262d]">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead className="bg-[#161b22] text-right text-[#8b949e]">
            <tr>
              {selectable ? (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="تحديد الكل"
                    className="h-4 w-4 accent-emerald-600"
                  />
                </th>
              ) : null}
              {shownColumns.map((c) => {
                const active = sort?.key === c.key;
                if (!c.sortable) {
                  return (
                    <th key={c.key} className={`px-3 py-2 font-medium ${align(c.align)}`}>
                      {c.label}
                    </th>
                  );
                }
                return (
                  <th key={c.key} className={`px-3 py-2 font-medium ${align(c.align)}`} aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button
                      type="button"
                      onClick={() => cycleSort(c.key)}
                      className="inline-flex items-center gap-1 font-medium hover:text-[#e6edf3]"
                    >
                      {c.label}
                      <span aria-hidden className={active ? 'text-[#e6edf3]' : 'text-[#484f58]'}>
                        {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-[#8b949e]">
                  {emptyAr}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const isSel = selected.has(row.id);
                return (
                  <tr
                    key={row.id}
                    tabIndex={onRowActivate ? 0 : undefined}
                    onKeyDown={
                      onRowActivate
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowActivate(row);
                            }
                          }
                        : undefined
                    }
                    className={[
                      'align-top',
                      onRowActivate ? 'cursor-pointer focus:outline-none focus-visible:bg-[#161b22]' : '',
                      isSel ? 'bg-[#161b22]' : '',
                    ].join(' ')}
                  >
                    {selectable ? (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(row.id)}
                          aria-label={`تحديد الصف ${row.id}`}
                          className="h-4 w-4 accent-emerald-600"
                        />
                      </td>
                    ) : null}
                    {shownColumns.map((c) => (
                      <td key={c.key} className={`px-3 py-2 ${align(c.align)}`}>
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {bulk && selectedRows.length > 0
        ? bulk({ rows: selectedRows, ids: [...selected], clear: clearSelection })
        : null}
    </div>
  );
}
