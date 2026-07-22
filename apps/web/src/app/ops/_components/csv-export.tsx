'use client';

import { rowsToCsv, downloadCsv, type CsvColumn } from '../_lib/csv';

/**
 * OPS-360 Unit 2 — one button that exports the CURRENT page's rows to CSV,
 * honoring column visibility (the caller passes only the visible columns, in
 * their display order). PDPL-safe by construction: it serializes the rows the
 * table already holds — masked at the read API — and never re-fetches. Money
 * cells carry their displayed SAR string verbatim.
 *
 * "Export the entire filtered set" (beyond this page) is intentionally NOT here
 * — that needs a governed, audited backend export endpoint (see _lib/csv.ts).
 */

export function CsvExport<Row>({
  columns,
  rows,
  filename,
  labelAr = 'تصدير CSV',
  disabled = false,
}: {
  /** Visible columns, in display order (label + plain-text cell extractor). */
  columns: CsvColumn<Row>[];
  rows: Row[];
  /** Base filename; a .csv suffix and the row count are appended for you. */
  filename: string;
  labelAr?: string;
  disabled?: boolean;
}) {
  const empty = rows.length === 0 || columns.length === 0;

  function run() {
    if (empty) return;
    const csv = rowsToCsv(columns, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${filename}-${stamp}`, csv);
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || empty}
      title={empty ? 'لا صفوف للتصدير' : 'تصدير الصفوف الظاهرة (هذه الصفحة) إلى CSV'}
      className="rounded border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-sm text-[#e6edf3] hover:bg-[#21262d] disabled:opacity-50"
    >
      <span aria-hidden className="ml-1">⬇︎</span>
      {labelAr}
      {!empty ? (
        <span className="text-[#8b949e]"> ({rows.length.toLocaleString('ar-SA')})</span>
      ) : null}
    </button>
  );
}
