'use client';

import { DataTable, type Column } from '../_components/data-table';
import { StatusBadge, type StatusIntent } from '../_components/badge';

/**
 * OPS Phase 2 — «الموردون والمزادات» RFQ oversight list. A thin client island
 * so the shared <DataTable> (which owns column render functions + keyboard
 * row activation) can be used from the server page. Rows carry no mutation —
 * every governed action lives on the RFQ detail page.
 */

export interface RfqRow {
  id: string;
  projectId: string;
  projectTitleAr: string | null;
  status: string;
  dueDate: string | null;
  awardedBidId: string | null;
  bidCount: number;
  createdAt: string | null;
}

const STATUS_INTENT: Record<string, StatusIntent> = {
  OPEN: 'info',
  AWARDED: 'ok',
  CLOSED: 'muted',
  CANCELLED: 'danger',
};

export function RfqsTable({ rows }: { rows: RfqRow[] }) {
  const columns: Column<RfqRow>[] = [
    {
      key: 'projectTitleAr',
      label: 'المشروع',
      render: (r) => (
        <a
          href={`/ops/suppliers/${r.id}`}
          className="text-[#58a6ff] hover:underline"
        >
          {r.projectTitleAr ?? '—'}
        </a>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (r) => (
        <StatusBadge intent={STATUS_INTENT[r.status] ?? 'muted'}>{r.status}</StatusBadge>
      ),
    },
    {
      key: 'bidCount',
      label: 'العروض',
      align: 'center',
      render: (r) => <span className="tabular-nums">{r.bidCount.toLocaleString('ar-SA-u-nu-latn')}</span>,
    },
    {
      key: 'dueDate',
      label: 'آخر موعد',
      render: (r) =>
        r.dueDate ? (
          <span className="whitespace-nowrap text-[#8b949e]">
            {new Date(r.dueDate).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium' })}
          </span>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'أُنشئ',
      render: (r) =>
        r.createdAt ? (
          <span className="whitespace-nowrap text-[#8b949e]">
            {new Date(r.createdAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'short' })}
          </span>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'open',
      label: '',
      align: 'left',
      render: (r) => (
        <a href={`/ops/suppliers/${r.id}`} className="text-xs text-[#58a6ff] hover:underline">
          فتح ←
        </a>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا طلبات عروض أسعار مطابقة"
      minWidth={720}
      onRowActivate={(r) => {
        window.location.href = `/ops/suppliers/${r.id}`;
      }}
    />
  );
}
