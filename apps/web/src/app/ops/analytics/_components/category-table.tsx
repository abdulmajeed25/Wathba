'use client';

import { DataTable, type Column } from '../../_components/data-table';
import { formatSar } from '../../_lib/money';
import type { CategoryRow } from '../_lib/labels';

/**
 * OPS-360 Unit 5 — per-category performance as a sortable, CSV-exportable table.
 *
 * This is a CLIENT island on purpose: DataTable is 'use client' and its columns
 * carry `render`/`csv`/`sortValue` FUNCTIONS, which cannot cross the server→client
 * boundary as props. So the column definitions live here, next to the table, and
 * the server page hands down only the plain, serializable rows. (The server page
 * never imports a function out of this file — it just mounts <CategoryTable/>.)
 */

const columns: Column<CategoryRow>[] = [
  {
    key: 'nameAr',
    label: 'الفئة',
    sortable: true,
    sortValue: (r) => r.nameAr,
    csv: (r) => r.nameAr,
  },
  {
    key: 'projectCount',
    label: 'عدد المشاريع',
    align: 'center',
    sortable: true,
    sortValue: (r) => r.projectCount,
    csv: (r) => String(r.projectCount),
    render: (r) => <span className="tabular-nums">{r.projectCount.toLocaleString('ar-SA')}</span>,
  },
  {
    key: 'raisedHalalas',
    label: 'المُجمَّع',
    align: 'left',
    sortable: true,
    // Numeric sort on the underlying halalas, not the formatted string.
    sortValue: (r) => Number(BigInt(r.raisedHalalas || '0')),
    csv: (r) => formatSar(r.raisedHalalas),
    render: (r) => <span className="tabular-nums">{formatSar(r.raisedHalalas)}</span>,
  },
];

export function CategoryTable({ rows }: { rows: CategoryRow[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا فئات ضمن هذا النطاق"
      minWidth={520}
      tableKey="analytics-per-category"
      csvFileName="wathba-analytics-per-category"
      csvLabelAr="تصدير الفئات CSV"
    />
  );
}
