'use client';

import { ActorName } from '../../_components/actor-name';
import { StatusBadge } from '../../_components/badge';
import { DataTable, type Column } from '../../_components/data-table';

/**
 * OPS-360 Unit 4 — the contest winners roster (masked). Backer identity is
 * resolved via <ActorName> (masked/permission-gated server-side); the announced
 * state is a badge. Read-only oversight — no ops.
 */

export interface WinnerRow {
  id: string;
  backer: { id: string; name: string | null; email: string | null };
  backerNo: number | null;
  rank: number | null;
  announced: boolean;
  announcedAt: string | null;
  prizeTitleAr: string | null;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium' }) : '—';
}

export function WinnersTable({ rows }: { rows: WinnerRow[] }) {
  const columns: Column<WinnerRow>[] = [
    {
      key: 'rank',
      label: 'الترتيب',
      align: 'center',
      sortable: true,
      sortValue: (r) => r.rank ?? 9999,
      csv: (r) => (r.rank != null ? String(r.rank) : ''),
      render: (r) => <span className="tabular-nums text-[#8b949e]">{r.rank ?? '—'}</span>,
    },
    {
      key: 'backerNo',
      label: '# الداعم',
      align: 'center',
      sortable: true,
      sortValue: (r) => r.backerNo ?? 0,
      csv: (r) => (r.backerNo != null ? String(r.backerNo) : ''),
      render: (r) => <span className="tabular-nums text-[#8b949e]">{r.backerNo ?? '—'}</span>,
    },
    {
      key: 'backer',
      label: 'الفائز',
      csv: (r) => r.backer.name ?? r.backer.id,
      render: (r) => (
        <div>
          <ActorName id={r.backer.id} className="text-sm" />
          {r.backer.email ? (
            <span className="block font-mono text-[11px] text-[#8b949e]" dir="ltr">
              {r.backer.email}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'prizeTitleAr',
      label: 'الجائزة',
      csv: (r) => r.prizeTitleAr ?? '',
      render: (r) => <span className="text-[#8b949e]">{r.prizeTitleAr ?? '—'}</span>,
    },
    {
      key: 'announced',
      label: 'الإعلان',
      sortable: true,
      sortValue: (r) => (r.announced ? 1 : 0),
      csv: (r) => (r.announced ? 'معلن' : 'غير معلن'),
      render: (r) =>
        r.announced ? (
          <StatusBadge intent="ok">معلن {r.announcedAt ? `· ${fmtDate(r.announcedAt)}` : ''}</StatusBadge>
        ) : (
          <StatusBadge intent="muted">غير معلن</StatusBadge>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا فائزون بعد"
      minWidth={760}
      tableKey="ops-contest-winners"
      csvFileName="wathba-contest-winners"
      csvLabelAr="تصدير CSV"
    />
  );
}
