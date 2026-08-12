'use client';

import Link from 'next/link';

import { StatusBadge } from '../../_components/badge';
import { BulkBar } from '../../_components/bulk-bar';
import { DataTable, type Column } from '../../_components/data-table';
import { formatSar } from '../../_lib/money';
import { statusIntent, statusLabel, type ProjectRow } from './status';

/**
 * OPS Phase 2 + OPS-360 Unit 3 — «المشاريع» list island. Owns the DataTable
 * (its column renderers must live client-side) and the governed bulk flow.
 *
 * Unit-3 adoptions:
 *  • DataTable power features — `tableKey` (column show/hide + reorder, gear),
 *    `savedViews`, CSV export of the visible page, and sortable headers on the
 *    money / backers / reports / status columns.
 *  • The new `openReportCount` column — sortable, and each non-zero count links
 *    to the trust/moderation queue filtered to this project.
 *  • The hand-rolled "one OpRunner per selected row" bulk is replaced by the
 *    generic <BulkBar>: hide + staff-pick on/off, each still individually
 *    dry-run→execute→audited per id (no blind fan-out).
 */

const numeric = (v: string | null): number => Number(String(v ?? '0').replace(/[^\d-]/g, '') || '0');

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const columns: Column<ProjectRow>[] = [
    {
      key: 'titleAr',
      label: 'المشروع',
      sortable: true,
      csv: (r) => r.titleAr,
      render: (r) => (
        <Link href={`/ops/projects/${r.id}`} className="text-[#58a6ff] hover:underline">
          {r.titleAr}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      csv: (r) => statusLabel(r.status),
      render: (r) => <StatusBadge intent={statusIntent(r.status)}>{statusLabel(r.status)}</StatusBadge>,
    },
    {
      key: 'category',
      label: 'الفئة',
      csv: (r) => r.categoryNameAr ?? '',
      render: (r) => r.categoryNameAr ?? <span className="text-[#484f58]">—</span>,
    },
    {
      key: 'money',
      label: 'المجموع / الهدف',
      sortable: true,
      sortValue: (r) => numeric(r.raisedHalalas),
      csv: (r) => `${formatSar(r.raisedHalalas)} / ${formatSar(r.goalHalalas)}`,
      render: (r) => (
        <span className="tabular-nums">
          {formatSar(r.raisedHalalas)}
          <span className="text-[#484f58]"> / </span>
          <span className="text-[#8b949e]">{formatSar(r.goalHalalas)}</span>
        </span>
      ),
    },
    {
      key: 'backersCount',
      label: 'الداعمون',
      align: 'center',
      sortable: true,
      sortValue: (r) => r.backersCount,
      csv: (r) => String(r.backersCount),
      render: (r) => <span className="tabular-nums">{r.backersCount.toLocaleString('ar-SA-u-nu-latn')}</span>,
    },
    {
      key: 'openReportCount',
      label: 'بلاغات مفتوحة',
      align: 'center',
      sortable: true,
      sortValue: (r) => r.openReportCount,
      csv: (r) => String(r.openReportCount),
      render: (r) =>
        r.openReportCount > 0 ? (
          <Link
            href="/ops/trust"
            title="فتح طابور الثقة والبلاغات"
            className="inline-block rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300 hover:bg-amber-500/20"
          >
            {r.openReportCount.toLocaleString('ar-SA-u-nu-latn')}
          </Link>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'createdBy',
      label: 'المبدع',
      csv: (r) => (r.createdBy ? `@${r.createdBy}` : ''),
      render: (r) =>
        r.createdBy ? (
          <span className="font-mono text-xs" dir="ltr">
            @{r.createdBy}
          </span>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'hidden',
      label: 'الظهور',
      align: 'center',
      csv: (r) => (r.hiddenAt ? 'مخفي' : 'ظاهر'),
      render: (r) =>
        r.hiddenAt ? (
          <StatusBadge intent="danger">مخفي</StatusBadge>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا مشاريع مطابقة للمرشحات"
      minWidth={980}
      selectable
      tableKey="ops-projects"
      savedViews
      csvFileName="wathba-projects"
      csvLabelAr="تصدير CSV"
      bulk={({ rows: selected, clear }) => (
        <BulkBar
          rows={selected}
          labelForRow={(r) => r.titleAr}
          onClear={clear}
          ops={[
            {
              opKey: 'moderation.project.hide',
              label: 'إخفاء المحدَّد',
              input: (r) => ({ projectId: r.id }),
              applicable: (r) => !r.hiddenAt,
              requiresReason: true,
              riskTier: 'STANDARD',
              variant: 'danger',
              describeAr: 'يُخفي المشاريع من القراءات العامة مع بقاء السجل. لا يشمل المخفية أصلاً.',
            },
            {
              opKey: 'projects.staff-pick.set',
              label: 'تمييز ضمن مختارات وثبة',
              input: (r) => ({ projectId: r.id, value: true }),
              riskTier: 'STANDARD',
              variant: 'primary',
              describeAr: 'يُدرج المشاريع ضمن مختارات وثبة.',
            },
            {
              opKey: 'projects.staff-pick.set',
              label: 'إزالة التمييز',
              input: (r) => ({ projectId: r.id, value: false }),
              riskTier: 'STANDARD',
              variant: 'ghost',
              describeAr: 'يُزيل المشاريع من مختارات وثبة.',
            },
          ]}
        />
      )}
    />
  );
}
