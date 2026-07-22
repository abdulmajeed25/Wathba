'use client';

import { ActorName } from '../_components/actor-name';
import { DataTable, type Column } from '../_components/data-table';
import { StatusBadge, type StatusIntent } from '../_components/badge';

/**
 * OPS Phase 2 + OPS-360 Unit 3 — «الدعم» inbox list. Client island wrapping the
 * shared <DataTable> (now with tableKey/savedViews/csv/sortable adopted). Rows
 * carry no mutation — assign / status / note / reply all live on the ticket
 * detail page. Email is already masked server-side, and the assignee UUID is
 * resolved to a name via <ActorName> (the census flagged raw UUID assignees).
 */

export interface TicketRow {
  id: string;
  name: string;
  email: string;
  topic: string;
  status: string;
  assignedToId: string | null;
  createdAt: string | null;
}

const STATUS_INTENT: Record<string, StatusIntent> = {
  OPEN: 'warn',
  IN_PROGRESS: 'info',
  RESOLVED: 'ok',
  CLOSED: 'muted',
};

const STATUS_AR: Record<string, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد المعالجة',
  RESOLVED: 'محلولة',
  CLOSED: 'مغلقة',
};

function ageAr(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days.toLocaleString('ar-SA')} يوم`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours.toLocaleString('ar-SA')} ساعة`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins.toLocaleString('ar-SA')} دقيقة`;
}

export function TicketsTable({ rows }: { rows: TicketRow[] }) {
  const columns: Column<TicketRow>[] = [
    {
      key: 'topic',
      label: 'الموضوع',
      sortable: true,
      csv: (r) => r.topic,
      render: (r) => (
        <a href={`/ops/support/${r.id}`} className="text-[#58a6ff] hover:underline">
          {r.topic}
        </a>
      ),
    },
    {
      key: 'name',
      label: 'صاحب التذكرة',
      sortable: true,
      csv: (r) => `${r.name} <${r.email}>`,
      sortValue: (r) => r.name,
      render: (r) => (
        <span>
          {r.name}
          <span className="block text-[11px] text-[#8b949e]" dir="ltr">
            {r.email}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      csv: (r) => STATUS_AR[r.status] ?? r.status,
      render: (r) => (
        <StatusBadge intent={STATUS_INTENT[r.status] ?? 'muted'}>
          {STATUS_AR[r.status] ?? r.status}
        </StatusBadge>
      ),
    },
    {
      key: 'assignedToId',
      label: 'المُسنَد إليه',
      csv: (r) => r.assignedToId ?? 'غير مُسنَدة',
      render: (r) =>
        r.assignedToId ? (
          <ActorName id={r.assignedToId} className="text-xs text-[#e6edf3]" />
        ) : (
          <span className="text-[#484f58]">غير مُسنَدة</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'العمر',
      sortable: true,
      csv: (r) => r.createdAt ?? '',
      sortValue: (r) => r.createdAt ?? '',
      render: (r) => <span className="whitespace-nowrap text-[#8b949e]">{ageAr(r.createdAt)}</span>,
    },
    {
      key: 'open',
      label: '',
      align: 'left',
      render: (r) => (
        <a href={`/ops/support/${r.id}`} className="text-xs text-[#58a6ff] hover:underline">
          فتح ←
        </a>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا تذاكر مطابقة للمرشحات"
      minWidth={760}
      tableKey="ops.support.tickets"
      savedViews
      csvFileName="ops-support-tickets"
      csvLabelAr="تصدير CSV"
      onRowActivate={(r) => {
        window.location.href = `/ops/support/${r.id}`;
      }}
    />
  );
}
