'use client';

import { useState } from 'react';

import { DataTable, type Column } from '../_components/data-table';
import { OpRunner } from '../_components/op-runner';
import { Badge } from '../_components/badge';

/**
 * OPS Phase 2 — «فريق العمل والأدوار» interactive surface. Pick a user from the
 * (masked) directory, then grant/revoke either an OPS role (RBAC — OWNER-only,
 * users.roles.assign) or a PRODUCT role (users.lifecycle). Every action is a
 * governed <OpRunner> (SENSITIVE, reason-gated). The role×permission matrix
 * itself is rendered read-only by the server page.
 */

export interface DirUser {
  id: string;
  name: string;
  email: string;
  handle: string | null;
  roles: string[];
  /** Unit 3: the user's real ops-role holdings (OWNER/FINANCE/…) from the DTO. */
  opsRoleKeys?: string[];
}

const OPS_ROLES = [
  'OWNER',
  'OPS_MANAGER',
  'REVIEWER',
  'FINANCE',
  'SUPPORT',
  'MODERATOR',
  'CONTENT_EDITOR',
  'ANALYST',
] as const;

const PRODUCT_ROLES = ['CREATOR', 'BACKER', 'SUPPLIER'] as const;

const INPUT =
  'rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm outline-none focus:border-emerald-500';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function TeamManager({
  users,
  canGrantOps,
  canGrantProduct,
}: {
  users: DirUser[];
  canGrantOps: boolean;
  canGrantProduct: boolean;
}) {
  const [userId, setUserId] = useState('');
  const [opsRoleKey, setOpsRoleKey] = useState<string>('REVIEWER');
  const [productRole, setProductRole] = useState<string>('CREATOR');

  const reload = () => window.location.reload();
  const userValid = UUID_RE.test(userId);

  const columns: Column<DirUser>[] = [
    {
      key: 'name',
      label: 'المستخدم',
      render: (u) => (
        <span>
          {u.name}
          {u.handle ? (
            <span className="block font-mono text-[11px] text-[#8b949e]">@{u.handle}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'البريد (مقنَّع)',
      render: (u) => (
        <span dir="ltr" className="text-[#8b949e]">
          {u.email}
        </span>
      ),
    },
    {
      key: 'opsRoleKeys',
      label: 'أدوار العمليات (RBAC)',
      render: (u) =>
        u.opsRoleKeys && u.opsRoleKeys.length ? (
          <span className="flex flex-wrap gap-1">
            {u.opsRoleKeys.map((r) => (
              <Badge
                key={r}
                className={
                  r === 'OWNER'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-[#1f6feb]/40 bg-[#1f6feb]/10 text-[#79c0ff]'
                }
              >
                {r}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'roles',
      label: 'أدوار المنتج',
      render: (u) =>
        u.roles.length ? (
          <span className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <Badge key={r} className="border-[#30363d] bg-[#161b22] text-[#8b949e]">
                {r}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
    {
      key: 'pick',
      label: '',
      align: 'left',
      render: (u) => (
        <button
          type="button"
          onClick={() => setUserId(u.id)}
          className="rounded border border-[#30363d] px-2 py-1 text-xs hover:bg-[#21262d]"
        >
          اختيار
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-2.5 text-xs text-[#8b949e]">
        عمود «أدوار العمليات (RBAC)» يعرض ما يحمله كل عضو فعلياً (OWNER/OPS_MANAGER/FINANCE/…) من
        واجهة القراءة مباشرةً — فلا حاجة لمراجعة سجل التدقيق قبل السحب.
      </p>

      <DataTable
        columns={columns}
        rows={users}
        emptyAr="لا مستخدمين"
        minWidth={760}
        onRowActivate={(u) => setUserId(u.id)}
        tableKey="ops.team.directory"
        csvFileName="ops-team"
        csvLabelAr="تصدير CSV"
      />

      <div className="grid gap-3 rounded-lg border border-[#21262d] bg-[#161b22] p-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs text-[#8b949e]">
            المستخدم المستهدف (اختر من الجدول أو الصق UUID)
          </span>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="UUID المستخدم"
            className={`${INPUT} w-full`}
            dir="ltr"
          />
        </label>

        {/* ── ops roles (OWNER only) ──────────────────────────────────── */}
        <fieldset className="space-y-2 rounded border border-[#30363d] p-3">
          <legend className="px-1 text-sm font-bold">دور العمليات (RBAC)</legend>
          {canGrantOps ? (
            <>
              <select
                value={opsRoleKey}
                onChange={(e) => setOpsRoleKey(e.target.value)}
                className={`${INPUT} w-full`}
              >
                {OPS_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <OpRunner
                  opKey="users.ops-role.grant"
                  input={{ userId, roleKey: opsRoleKey }}
                  triggerLabel="منح دور العمليات"
                  riskTier="SENSITIVE"
                  requiresReason
                  variant="primary"
                  disabled={!userValid}
                  onDone={reload}
                />
                <OpRunner
                  opKey="users.ops-role.revoke"
                  input={{ userId, roleKey: opsRoleKey }}
                  triggerLabel="سحب دور العمليات"
                  riskTier="SENSITIVE"
                  requiresReason
                  variant="danger"
                  disabled={!userValid}
                  onDone={reload}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-[#8b949e]">
              منح/سحب أدوار العمليات للمالك فقط (users.roles.assign).
            </p>
          )}
        </fieldset>

        {/* ── product roles ───────────────────────────────────────────── */}
        <fieldset className="space-y-2 rounded border border-[#30363d] p-3">
          <legend className="px-1 text-sm font-bold">دور المنتج</legend>
          {canGrantProduct ? (
            <>
              <select
                value={productRole}
                onChange={(e) => setProductRole(e.target.value)}
                className={`${INPUT} w-full`}
              >
                {PRODUCT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <OpRunner
                  opKey="users.role.grant"
                  input={{ userId, role: productRole }}
                  triggerLabel="منح دور المنتج"
                  riskTier="SENSITIVE"
                  requiresReason
                  variant="primary"
                  disabled={!userValid}
                  onDone={reload}
                />
                <OpRunner
                  opKey="users.role.revoke"
                  input={{ userId, role: productRole }}
                  triggerLabel="سحب دور المنتج"
                  riskTier="SENSITIVE"
                  requiresReason
                  variant="danger"
                  disabled={!userValid}
                  onDone={reload}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-[#8b949e]">
              منح/سحب أدوار المنتج يتطلب صلاحية users.lifecycle.
            </p>
          )}
        </fieldset>
      </div>
    </div>
  );
}
