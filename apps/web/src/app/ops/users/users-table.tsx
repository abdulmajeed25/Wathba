'use client';

import Link from 'next/link';

import { StatusBadge } from '../_components/badge';
import { DataTable, type Column } from '../_components/data-table';
import { formatSar } from '../_lib/money';

/**
 * OPS Phase 2 — the «المستخدمون» directory table. A thin client island: the
 * server component fetches (masked) rows and hands them here as plain data;
 * this file only owns the column renderers (badges, links, formatSar). No PII
 * is un-masked here — `email` arrives pre-masked from the API.
 */

export interface UserRow {
  id: string;
  name: string;
  email: string;
  handle: string | null;
  roles: string[];
  suspendedAt: string | null;
  suspendedKind: 'SUSPENDED' | 'BANNED' | null;
  nafathVerified: boolean;
  supplierVerifiedAt: string | null;
  totalPledgedHalalas: string | null;
  createdAt: string;
}

const ROLE_AR: Record<string, string> = {
  ADMIN: 'مشرف',
  CREATOR: 'صاحب مشروع',
  BACKER: 'داعم',
  SUPPLIER: 'مورّد',
};

const COLUMNS: Column<UserRow>[] = [
  {
    key: 'name',
    label: 'المستخدم',
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
    render: (u) => (
      <span dir="ltr" className="font-mono text-xs text-[#8b949e]">
        {u.email}
      </span>
    ),
  },
  {
    key: 'roles',
    label: 'الأدوار',
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
    key: 'status',
    label: 'الحالة',
    render: (u) =>
      u.suspendedKind === 'BANNED' ? (
        <StatusBadge intent="danger">محظور</StatusBadge>
      ) : u.suspendedAt ? (
        <StatusBadge intent="warn">موقوف</StatusBadge>
      ) : (
        <StatusBadge intent="ok">نشط</StatusBadge>
      ),
  },
  {
    key: 'nafath',
    label: 'نفاذ',
    align: 'center',
    render: (u) =>
      u.nafathVerified ? (
        <span className="text-emerald-400" title="موثّق عبر نفاذ">
          ✓
        </span>
      ) : (
        <span className="text-[#484f58]">—</span>
      ),
  },
  {
    key: 'supplier',
    label: 'مورّد',
    align: 'center',
    render: (u) =>
      u.supplierVerifiedAt ? (
        <span
          className="text-emerald-400"
          title={new Date(u.supplierVerifiedAt).toLocaleString('ar-SA')}
        >
          ✓
        </span>
      ) : (
        <span className="text-[#484f58]">—</span>
      ),
  },
  {
    key: 'pledged',
    label: 'إجمالي التعهّد',
    align: 'left',
    render: (u) => <span className="tabular-nums">{formatSar(u.totalPledgedHalalas)}</span>,
  },
  {
    key: 'createdAt',
    label: 'الانضمام',
    render: (u) => (
      <span className="whitespace-nowrap text-[#8b949e]">
        {new Date(u.createdAt).toLocaleDateString('ar-SA', { dateStyle: 'medium' })}
      </span>
    ),
  },
];

export function UsersTable({ rows, emptyAr }: { rows: UserRow[]; emptyAr: string }) {
  return <DataTable columns={COLUMNS} rows={rows} emptyAr={emptyAr} minWidth={960} />;
}
