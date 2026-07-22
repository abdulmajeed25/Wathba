'use client';

import Link from 'next/link';

import { StatusBadge } from '../../../_components/badge';
import { DataTable, type Column } from '../../../_components/data-table';
import { formatSar } from '../../../_lib/money';

/**
 * OPS-360 Unit 3 — a supplier's bids across every RFQ, as the shared
 * <DataTable> (sortable amount/status columns + CSV export of the masked page).
 * Client island because DataTable's cell renderers (links, badges) run in the
 * browser; the data itself is fetched server-side in the profile page.
 */

export interface SupplierBidRow {
  id: string;
  rfqId: string;
  projectId: string | null;
  rfqStatus: string | null;
  amountHalalas: string | null;
  leadTimeDays: number | null;
  status: string;
  createdAt: string | null;
}

const BID_INTENT: Record<string, 'ok' | 'warn' | 'danger' | 'muted'> = {
  AWARDED: 'ok',
  SHORTLISTED: 'warn',
  REJECTED: 'danger',
  WITHDRAWN: 'muted',
  SUBMITTED: 'muted',
};

const numeric = (v: string | null): number => Number(String(v ?? '0').replace(/[^\d-]/g, '') || '0');

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('ar-SA', { dateStyle: 'medium' }) : '—';
}

export function SupplierBidsTable({ rows }: { rows: SupplierBidRow[] }) {
  const columns: Column<SupplierBidRow>[] = [
    {
      key: 'rfqId',
      label: 'طلب العرض',
      csv: (r) => r.rfqId,
      render: (r) => (
        <Link href={`/ops/suppliers/${r.rfqId}`} className="font-mono text-xs text-[#58a6ff] hover:underline" dir="ltr">
          {r.rfqId.slice(0, 8)}…
        </Link>
      ),
    },
    {
      key: 'amountHalalas',
      label: 'قيمة العرض',
      sortable: true,
      sortValue: (r) => numeric(r.amountHalalas),
      csv: (r) => formatSar(r.amountHalalas),
      render: (r) => <span className="tabular-nums">{formatSar(r.amountHalalas)}</span>,
    },
    {
      key: 'leadTimeDays',
      label: 'مدّة التوريد (يوم)',
      align: 'center',
      sortable: true,
      sortValue: (r) => r.leadTimeDays ?? 0,
      csv: (r) => (r.leadTimeDays != null ? String(r.leadTimeDays) : ''),
      render: (r) =>
        r.leadTimeDays != null ? (
          <span className="tabular-nums">{r.leadTimeDays.toLocaleString('ar-SA')}</span>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'status',
      label: 'حالة العرض',
      sortable: true,
      csv: (r) => r.status,
      render: (r) => <StatusBadge intent={BID_INTENT[r.status] ?? 'muted'}>{r.status}</StatusBadge>,
    },
    {
      key: 'rfqStatus',
      label: 'حالة الطلب',
      csv: (r) => r.rfqStatus ?? '',
      render: (r) =>
        r.rfqStatus ? <span className="text-xs text-[#8b949e]">{r.rfqStatus}</span> : <span className="text-[#484f58]">—</span>,
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
      emptyAr="لا عروض مقدَّمة من هذا المورّد"
      minWidth={720}
      tableKey="ops-supplier-bids"
      csvFileName="wathba-supplier-bids"
      csvLabelAr="تصدير CSV"
    />
  );
}
