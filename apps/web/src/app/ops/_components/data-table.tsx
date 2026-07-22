'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * OPS Part 5 — the reusable server-data table. Data is always fetched in a
 * server component; this island only renders it (and, optionally, drives
 * multi-select for bulk actions). Styling mirrors «سجل التدقيق» exactly:
 * overflow-x-auto, min-w, thead bg #161b22 text-right, tbody divide-y.
 *
 * Rows are keyboard-focusable; when `onRowActivate` is set, Enter/Space on a
 * focused row fires it. Selection adds a checkbox column with a header
 * select-all and reports the selected ids upward.
 */

export interface Column<Row> {
  key: string;
  label: string;
  align?: 'right' | 'left' | 'center';
  /** Custom cell renderer; defaults to `String(row[key])`. */
  render?: (row: Row) => ReactNode;
}

export function DataTable<Row extends { id: string }>({
  columns,
  rows,
  emptyAr,
  minWidth = 700,
  selectable = false,
  onSelectionChange,
  onRowActivate,
}: {
  columns: Column<Row>[];
  rows: Row[];
  emptyAr: string;
  minWidth?: number;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  onRowActivate?: (row: Row) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

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

  const align = (a?: Column<Row>['align']) =>
    a === 'left' ? 'text-left' : a === 'center' ? 'text-center' : 'text-right';

  const colCount = columns.length + (selectable ? 1 : 0);

  return (
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
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-medium ${align(c.align)}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#21262d] bg-[#0d1117]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-3 py-8 text-center text-[#8b949e]">
                {emptyAr}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
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
                  {columns.map((c) => (
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
  );
}
