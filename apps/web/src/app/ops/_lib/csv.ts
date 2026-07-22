/**
 * OPS-360 Unit 2 — CSV serialization for the "export what's on screen" button.
 *
 * PDPL posture: this NEVER re-fetches. It serializes exactly the rows the read
 * API already returned to the current page — which are masked at the source
 * (see ops-read.service PII masking). Whatever the operator can see, they can
 * export; nothing more. Money cells carry the already-formatted SAR string, so
 * the export matches the on-screen figure to the halalah with no re-derivation.
 *
 * Scope is deliberately the CURRENT PAGE ONLY. Exporting an entire filtered set
 * that spans cursors would fan out reads (and could leak volume beyond what the
 * operator actually reviewed) — that belongs behind a governed, audited backend
 * export endpoint (streamed, rate-limited, logged). FOLLOW-UP, not this unit.
 */

/** RFC-4180 escape: quote a field iff it contains a comma, quote, CR or LF. */
function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize a header row + body rows to an RFC-4180 CSV string (CRLF). */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((cells) => cells.map(escapeField).join(','));
  return lines.join('\r\n');
}

/**
 * Trigger a client-side download of `csv` as `filename`. Prepends a UTF-8 BOM
 * so Excel opens Arabic (and the SAR glyph) correctly instead of mojibake.
 * No-op during SSR.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has fired.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A column, reduced to the two things CSV cares about: a header + a cell text. */
export interface CsvColumn<Row> {
  label: string;
  /** Plain-text cell value (NOT JSX). Money passes its formatSar string. */
  cell: (row: Row) => string;
}

/** Build the full CSV string from typed columns + rows. */
export function rowsToCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const headers = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => c.cell(r) ?? ''));
  return toCsv(headers, body);
}
