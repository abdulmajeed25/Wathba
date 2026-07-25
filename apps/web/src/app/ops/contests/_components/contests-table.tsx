'use client';

import Link from 'next/link';

import { StatusBadge } from '../../_components/badge';
import { DataTable, type Column } from '../../_components/data-table';
import { contestStatusIntent, contestStatusLabel, type ContestRow } from './contest-status';

/**
 * OPS-360 Unit 4 — «المسابقات»: cross-project contest oversight list. Shared
 * <DataTable> (tableKey persistence + CSV + sortable). Read-only: contests are
 * creator-driven, so there are no OpRunners — the project link + the detail
 * drill-down are the only affordances.
 */

export function ContestsTable({ rows }: { rows: ContestRow[] }) {
  const columns: Column<ContestRow>[] = [
    {
      key: 'projectTitleAr',
      label: 'المشروع',
      csv: (r) => r.projectTitleAr ?? r.projectId,
      render: (r) => (
        <Link href={`/ops/projects/${r.projectId}`} className="text-[#58a6ff] hover:underline">
          {r.projectTitleAr ?? r.projectId.slice(0, 8) + '…'}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      csv: (r) => contestStatusLabel(r.status),
      render: (r) => (
        <StatusBadge intent={contestStatusIntent(r.status)}>
          {contestStatusLabel(r.status)}
        </StatusBadge>
      ),
    },
    {
      // CLOSEOUT C5 — was «المشاركات» reading `r.entryCount`, a field the API has
      // never sent and cannot: Contest has no entries relation at all (only
      // `winners`), so there is no entry count in the data model. Reading it
      // undefined and calling .toLocaleString() on it made /ops/contests 500 on
      // every load. Show target-vs-actual winners instead — both are real, and
      // together they are the oversight number this column was reaching for.
      key: 'targetWinnersCount',
      label: 'الفائزون المستهدفون',
      align: 'center',
      sortable: true,
      sortValue: (r) => r.targetWinnersCount,
      csv: (r) => String(r.targetWinnersCount),
      render: (r) => (
        <span className="tabular-nums">{r.targetWinnersCount.toLocaleString('ar-SA')}</span>
      ),
    },
    {
      key: 'winnerCount',
      label: 'الفائزون',
      align: 'center',
      sortable: true,
      sortValue: (r) => r.winnerCount,
      csv: (r) => String(r.winnerCount),
      render: (r) => (
        <span className="tabular-nums text-[#8b949e]">
          {r.winnerCount.toLocaleString('ar-SA')}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      align: 'left',
      render: (r) => (
        <Link href={`/ops/contests/${r.id}`} className="text-sm text-[#58a6ff] hover:underline">
          تفاصيل ←
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا مسابقات مطابقة"
      minWidth={720}
      tableKey="ops-contests"
      csvFileName="wathba-contests"
      csvLabelAr="تصدير CSV"
    />
  );
}
