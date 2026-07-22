'use client';

import Link from 'next/link';

import { ActorName } from '../../_components/actor-name';
import { StatusBadge } from '../../_components/badge';
import { DataTable, type Column } from '../../_components/data-table';
import { REWARD_STATUS_INTENT, rewardStatusLabel } from '../status';

/**
 * OPS-360 Unit 4 — «تسليم المكافآت»: the cross-project reward-fulfillment
 * roster. Shared <DataTable> (CSV + sortable + column persist). This is the A7
 * "fulfillment has no ops surface" observability screen — read-only: delivery
 * is creator bookkeeping, no ops override exists yet.
 */

export interface FulfillmentRow {
  /** DataTable requires a stable `id`; we alias the pledge id. */
  id: string;
  pledgeId: string;
  projectId: string;
  projectTitleAr: string | null;
  backer: { id: string; name: string | null; email: string | null };
  tierTitleAr: string | null;
  rewardStatus: string;
  backerNo: number | null;
}

export function FulfillmentTable({ rows }: { rows: FulfillmentRow[] }) {
  const columns: Column<FulfillmentRow>[] = [
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
      key: 'backer',
      label: 'الداعم',
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
      key: 'tierTitleAr',
      label: 'المستوى',
      csv: (r) => r.tierTitleAr ?? '',
      render: (r) => <span className="text-[#8b949e]">{r.tierTitleAr ?? '—'}</span>,
    },
    {
      key: 'rewardStatus',
      label: 'حالة التسليم',
      sortable: true,
      csv: (r) => rewardStatusLabel(r.rewardStatus),
      render: (r) => (
        <StatusBadge intent={REWARD_STATUS_INTENT[r.rewardStatus] ?? 'muted'}>
          {rewardStatusLabel(r.rewardStatus)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا مكافآت مطابقة"
      minWidth={820}
      tableKey="ops-fulfillment"
      csvFileName="wathba-fulfillment"
      csvLabelAr="تصدير CSV"
    />
  );
}
