'use client';

import { ActorName } from '../../_components/actor-name';
import { StatusBadge } from '../../_components/badge';
import { DataTable, type Column } from '../../_components/data-table';
import { formatSar } from '../../_lib/money';

/**
 * OPS-360 Unit 3 — the FULL backer roster (replaces the "last 20" cap in the
 * project detail). Shared <DataTable> with CSV export + sortable money/status,
 * masked PII from the API, and <ActorName> to resolve the backer id → name.
 */

export interface BackerRow {
  id: string;
  projectId: string;
  backerNo: number | null;
  backer: { id: string; name: string | null; email: string };
  amountHalalas: string | null;
  addOnsHalalas: string | null;
  status: string;
  rewardStatus: string | null;
  tierId: string | null;
  createdAt: string | null;
}

const REWARD_INTENT: Record<string, 'ok' | 'warn' | 'danger' | 'muted' | 'info'> = {
  FULFILLED: 'ok',
  SHIPPED: 'info',
  IN_PROGRESS: 'warn',
  PENDING: 'muted',
  CANCELLED: 'danger',
};

const numeric = (v: string | null): number => Number(String(v ?? '0').replace(/[^\d-]/g, '') || '0');

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('ar-SA', { dateStyle: 'medium' }) : '—';
}

export function BackersTable({ rows }: { rows: BackerRow[] }) {
  const columns: Column<BackerRow>[] = [
    {
      key: 'backerNo',
      label: '#',
      align: 'center',
      sortable: true,
      sortValue: (r) => r.backerNo ?? 0,
      csv: (r) => (r.backerNo != null ? String(r.backerNo) : ''),
      render: (r) => <span className="tabular-nums text-[#8b949e]">{r.backerNo ?? '—'}</span>,
    },
    {
      key: 'backer',
      label: 'الداعم',
      csv: (r) => r.backer.name ?? r.backer.id,
      render: (r) => (
        <div>
          <ActorName id={r.backer.id} className="text-sm" />
          <span className="block font-mono text-[11px] text-[#8b949e]" dir="ltr">
            {r.backer.email}
          </span>
        </div>
      ),
    },
    {
      key: 'amountHalalas',
      label: 'المبلغ',
      sortable: true,
      sortValue: (r) => numeric(r.amountHalalas),
      csv: (r) => formatSar(r.amountHalalas),
      render: (r) => <span className="tabular-nums">{formatSar(r.amountHalalas)}</span>,
    },
    {
      key: 'addOnsHalalas',
      label: 'الإضافات',
      sortable: true,
      sortValue: (r) => numeric(r.addOnsHalalas),
      csv: (r) => formatSar(r.addOnsHalalas),
      render: (r) => <span className="tabular-nums text-[#8b949e]">{formatSar(r.addOnsHalalas)}</span>,
    },
    {
      key: 'status',
      label: 'حالة التعهّد',
      sortable: true,
      csv: (r) => r.status,
      render: (r) => <StatusBadge intent="muted">{r.status}</StatusBadge>,
    },
    {
      key: 'rewardStatus',
      label: 'حالة المكافأة',
      sortable: true,
      csv: (r) => r.rewardStatus ?? '',
      render: (r) =>
        r.rewardStatus ? (
          <StatusBadge intent={REWARD_INTENT[r.rewardStatus] ?? 'muted'}>{r.rewardStatus}</StatusBadge>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'التاريخ',
      sortable: true,
      sortValue: (r) => r.createdAt ?? '',
      csv: (r) => fmtDate(r.createdAt),
      render: (r) => <span className="text-xs text-[#8b949e]">{fmtDate(r.createdAt)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا تعهّدات بعد"
      minWidth={820}
      tableKey="ops-project-backers"
      csvFileName="wathba-project-backers"
      csvLabelAr="تصدير CSV"
    />
  );
}
