'use client';

import Link from 'next/link';

import { StatusBadge } from '../_components/badge';
import { DataTable, type Column } from '../_components/data-table';
import { OpRunner } from '../_components/op-runner';
import type { UserRow } from './users-table';

/**
 * OPS-360 Unit 3 — the KYC / Nafath escalation worklist (the census flagged this
 * as missing). Fed by GET /v1/ops/users/kyc-queue: accounts not yet
 * Nafath-verified, or — with the supplierUnverified filter — SUPPLIER accounts
 * still awaiting suppliers.verify. Each row carries the two governed unblock ops
 * INLINE so an operator clears the queue without leaving it:
 *
 *   · users.kyc.force-verify — manual Nafath override (SENSITIVE, reason-gated).
 *   · suppliers.verify — operational supplier verification (STANDARD).
 *
 * Both are <OpRunner>s (dry-run → preview → execute → audited); a successful run
 * reloads the server component so the cleared row drops out of the queue.
 */

const ROLE_AR: Record<string, string> = {
  ADMIN: 'مشرف',
  CREATOR: 'صاحب مشروع',
  BACKER: 'داعم',
  SUPPLIER: 'مورّد',
};

export function KycQueueTable({
  rows,
  emptyAr,
  supplierMode,
}: {
  rows: UserRow[];
  emptyAr: string;
  /** true when the queue is the SUPPLIER-verification variant. */
  supplierMode: boolean;
}) {
  const reload = () => window.location.reload();

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      label: 'المستخدم',
      csv: (u) => u.name || '—',
      render: (u) => (
        <Link href={`/ops/users/${u.id}`} className="text-[#58a6ff] hover:underline">
          {u.name || '—'}
          {u.handle ? <span className="mr-1 text-[11px] text-[#8b949e]">@{u.handle}</span> : null}
        </Link>
      ),
    },
    {
      key: 'email',
      label: 'البريد (مقنّع)',
      csv: (u) => u.email,
      render: (u) => (
        <span dir="ltr" className="font-mono text-xs text-[#8b949e]">
          {u.email}
        </span>
      ),
    },
    {
      key: 'roles',
      label: 'الأدوار',
      csv: (u) => u.roles.join(' / '),
      render: (u) =>
        u.roles.length ? (
          <span className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <StatusBadge key={r} intent={r === 'ADMIN' ? 'info' : 'muted'}>
                {ROLE_AR[r] ?? r}
              </StatusBadge>
            ))}
          </span>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'nafath',
      label: 'نفاذ',
      align: 'center',
      csv: (u) => (u.nafathVerified ? 'موثّق' : 'غير موثّق'),
      render: (u) =>
        u.nafathVerified ? (
          <StatusBadge intent="ok">موثّق</StatusBadge>
        ) : (
          <StatusBadge intent="warn">غير موثّق</StatusBadge>
        ),
    },
    {
      key: 'supplier',
      label: 'توثيق مورّد',
      align: 'center',
      csv: (u) => (u.supplierVerifiedAt ? 'موثّق' : 'غير موثّق'),
      render: (u) =>
        u.supplierVerifiedAt ? (
          <StatusBadge intent="ok">موثّق</StatusBadge>
        ) : (
          <StatusBadge intent="muted">—</StatusBadge>
        ),
    },
    {
      key: 'act',
      label: 'المعالجة',
      align: 'left',
      render: (u) => (
        <div className="flex flex-wrap justify-end gap-2">
          {!u.nafathVerified ? (
            <OpRunner
              opKey="users.kyc.force-verify"
              input={{ userId: u.id }}
              triggerLabel="فرض توثيق نفاذ"
              riskTier="SENSITIVE"
              requiresReason
              variant="ghost"
              onDone={reload}
            />
          ) : null}
          {u.roles.includes('SUPPLIER') && !u.supplierVerifiedAt ? (
            <OpRunner
              opKey="suppliers.verify"
              input={{ userId: u.id }}
              triggerLabel="توثيق مورّد"
              riskTier="STANDARD"
              requiresReason={false}
              variant="primary"
              onDone={reload}
            />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      emptyAr={emptyAr}
      minWidth={880}
      tableKey={supplierMode ? 'ops.users.kyc.supplier' : 'ops.users.kyc.nafath'}
      csvFileName={supplierMode ? 'ops-kyc-suppliers' : 'ops-kyc-nafath'}
      csvLabelAr="تصدير CSV"
    />
  );
}
