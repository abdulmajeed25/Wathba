'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { StatusBadge } from '../_components/badge';
import { appealStatusIntent, appealStatusLabel } from './status';
import { DataTable, type Column } from '../_components/data-table';

/**
 * OPS-GAPS R1 — «التظلّمات» queue island. Renders the moderation appeals queue
 * (GET /v1/ops/appeals) as the shared <DataTable> with tableKey/savedViews/csv,
 * a kind badge, the masked submitter, a status badge, the SLA age with an
 * OVERDUE red flag, and createdAt. Rows link to the per-appeal workspace.
 *
 * Data is fetched server-side (page.tsx) and passed in; this island only
 * renders + drives keyboard row activation → the detail route.
 */

export interface AppealRow {
  id: string;
  kind: 'ACCOUNT_BAN' | 'PROJECT_REJECTION' | string;
  kindAr: string;
  subjectId: string;
  status: string;
  ageHours: number;
  overdue: boolean;
  submitter: string;
  createdAt: string;
  decidedAt: string | null;
}

/** Appeal status → badge hue. */
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function fmtAge(hours: number): string {
  if (hours < 24) return `${Math.round(hours).toLocaleString('ar-SA')} ساعة`;
  return `${Math.round(hours / 24).toLocaleString('ar-SA')} يوم`;
}

export function AppealsTable({ rows }: { rows: AppealRow[] }) {
  const router = useRouter();

  const columns: Column<AppealRow>[] = [
    {
      key: 'kindAr',
      label: 'النوع',
      csv: (r) => r.kindAr,
      render: (r) => (
        <StatusBadge intent={r.kind === 'ACCOUNT_BAN' ? 'danger' : 'warn'}>{r.kindAr}</StatusBadge>
      ),
    },
    {
      key: 'submitter',
      label: 'مُقدِّم التظلّم',
      csv: (r) => r.submitter,
      render: (r) => (
        <Link
          href={`/ops/appeals/${r.id}`}
          className="text-[#58a6ff] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {r.submitter}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      csv: (r) => appealStatusLabel(r.status),
      render: (r) => (
        <StatusBadge intent={appealStatusIntent(r.status)}>{appealStatusLabel(r.status)}</StatusBadge>
      ),
    },
    {
      key: 'ageHours',
      label: 'العمر (SLA)',
      sortable: true,
      sortValue: (r) => r.ageHours,
      csv: (r) => `${Math.round(r.ageHours)}h${r.overdue ? ' OVERDUE' : ''}`,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="tabular-nums text-[#8b949e]">{fmtAge(r.ageHours)}</span>
          {r.overdue ? (
            <span className="rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[11px] font-bold text-red-300">
              تجاوز SLA
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'قُدِّم في',
      sortable: true,
      sortValue: (r) => r.createdAt,
      csv: (r) => r.createdAt,
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-[#8b949e]">{fmtDate(r.createdAt)}</span>
      ),
    },
    {
      key: 'decidedAt',
      label: 'حُسِم في',
      csv: (r) => r.decidedAt ?? '',
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-[#8b949e]">{fmtDate(r.decidedAt)}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا تظلّمات مطابقة."
      minWidth={760}
      tableKey="ops-appeals"
      savedViews
      csvFileName="appeals"
      csvLabelAr="تصدير CSV"
      onRowActivate={(r) => router.push(`/ops/appeals/${r.id}`)}
    />
  );
}
