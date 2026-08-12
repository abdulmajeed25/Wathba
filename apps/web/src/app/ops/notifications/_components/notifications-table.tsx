'use client';

import { StatusBadge, type StatusIntent } from '../../_components/badge';
import { DataTable, type Column } from '../../_components/data-table';
import { OpRunner } from '../../_components/op-runner';

/**
 * OPS-360 Unit 4 — «الإشعارات»: the per-user notification roster. Renders the
 * masked GET /v1/ops/users/:id/notifications feed in the shared <DataTable>
 * (kind badge, read/unread, createdAt, payload summary).
 * OPS-360 Unit 6 — gains a governed resend (notifications.resend) per row so an
 * operator can re-deliver a missed notice.
 */

export interface NotificationRow {
  id: string;
  kind: string;
  readAt: string | null;
  createdAt: string | null;
  payloadSummary: string | null;
}

/** Coarse intent per notification family (prefix before the first '.'/'_'). */
const KIND_INTENT: Record<string, StatusIntent> = {
  PLEDGE: 'ok',
  PAYOUT: 'ok',
  REFUND: 'warn',
  DISPUTE: 'danger',
  PROJECT: 'info',
  MILESTONE: 'info',
  COMMENT: 'muted',
  REWARD: 'ok',
  CONTEST: 'info',
  SYSTEM: 'muted',
};

function kindIntent(kind: string): StatusIntent {
  const head = kind.split(/[._-]/)[0]?.toUpperCase() ?? '';
  return KIND_INTENT[head] ?? 'muted';
}

function fmtDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
}

export function NotificationsTable({ rows }: { rows: NotificationRow[] }) {
  const columns: Column<NotificationRow>[] = [
    {
      key: 'kind',
      label: 'النوع',
      sortable: true,
      csv: (r) => r.kind,
      render: (r) => <StatusBadge intent={kindIntent(r.kind)}>{r.kind}</StatusBadge>,
    },
    {
      key: 'readAt',
      label: 'الحالة',
      sortable: true,
      sortValue: (r) => (r.readAt ? 1 : 0),
      csv: (r) => (r.readAt ? 'مقروء' : 'غير مقروء'),
      render: (r) =>
        r.readAt ? (
          <StatusBadge intent="muted">مقروء</StatusBadge>
        ) : (
          <StatusBadge intent="info">غير مقروء</StatusBadge>
        ),
    },
    {
      key: 'payloadSummary',
      label: 'الملخّص',
      csv: (r) => r.payloadSummary ?? '',
      render: (r) => (
        <span className="text-[#8b949e]">{r.payloadSummary ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'التاريخ',
      align: 'left',
      sortable: true,
      sortValue: (r) => r.createdAt ?? '',
      csv: (r) => fmtDate(r.createdAt),
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-[#8b949e]">{fmtDate(r.createdAt)}</span>
      ),
    },
    {
      key: 'resend',
      label: 'إعادة الإرسال',
      align: 'left',
      render: (r) => (
        <OpRunner
          opKey="notifications.resend"
          input={{ notificationId: r.id }}
          triggerLabel="إعادة إرسال"
          riskTier="STANDARD"
          requiresReason
          variant="ghost"
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr="لا إشعارات لهذا المستخدم"
      minWidth={720}
      tableKey="ops-user-notifications"
      csvFileName="wathba-user-notifications"
      csvLabelAr="تصدير CSV"
    />
  );
}
