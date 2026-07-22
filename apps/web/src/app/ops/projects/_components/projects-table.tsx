'use client';

import Link from 'next/link';
import { useState } from 'react';

import { StatusBadge } from '../../_components/badge';
import { DataTable, type Column } from '../../_components/data-table';
import { OpRunner } from '../../_components/op-runner';
import { formatSar } from '../../_lib/money';
import { statusIntent, statusLabel, type ProjectRow } from './status';

/**
 * OPS Phase 2 — «المشاريع» list island. Owns the DataTable (its column
 * renderers must live client-side), multi-select, and the bulk bar. Bulk is
 * expressed as ONE governed OpRunner per selected project — every blast still
 * flows through dry-run → preview → reason → execute individually, so an
 * operator never fires a hidden fan-out. The selected set drives which
 * per-id runners render.
 */

type BulkMode = 'hide' | 'staff-pick-on' | 'staff-pick-off' | null;

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<BulkMode>(null);

  const selected = rows.filter((r) => selectedIds.includes(r.id));

  const columns: Column<ProjectRow>[] = [
    {
      key: 'titleAr',
      label: 'المشروع',
      render: (r) => (
        <Link href={`/ops/projects/${r.id}`} className="text-[#58a6ff] hover:underline">
          {r.titleAr}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (r) => <StatusBadge intent={statusIntent(r.status)}>{statusLabel(r.status)}</StatusBadge>,
    },
    {
      key: 'category',
      label: 'الفئة',
      render: (r) => r.categoryNameAr ?? <span className="text-[#484f58]">—</span>,
    },
    {
      key: 'money',
      label: 'المجموع / الهدف',
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
      render: (r) => <span className="tabular-nums">{r.backersCount.toLocaleString('ar-SA')}</span>,
    },
    {
      key: 'createdBy',
      label: 'المبدع',
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
      render: (r) =>
        r.hiddenAt ? (
          <StatusBadge intent="danger">مخفي</StatusBadge>
        ) : (
          <span className="text-[#484f58]">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        rows={rows}
        emptyAr="لا مشاريع مطابقة للمرشحات"
        minWidth={900}
        selectable
        onSelectionChange={(ids) => {
          setSelectedIds(ids);
          if (ids.length === 0) setMode(null);
        }}
      />

      {selected.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-[#30363d] bg-[#161b22] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold">
              محدَّد: {selected.length.toLocaleString('ar-SA')} مشروع
            </span>
            <button
              type="button"
              onClick={() => setMode('hide')}
              className={`rounded border px-3 py-1.5 text-sm ${
                mode === 'hide'
                  ? 'border-red-500/50 bg-red-500/10 text-red-300'
                  : 'border-[#30363d] hover:bg-[#21262d]'
              }`}
            >
              إخفاء المحدَّد
            </button>
            <button
              type="button"
              onClick={() => setMode('staff-pick-on')}
              className={`rounded border px-3 py-1.5 text-sm ${
                mode === 'staff-pick-on'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-[#30363d] hover:bg-[#21262d]'
              }`}
            >
              تمييز ضمن مختارات وثبة
            </button>
            <button
              type="button"
              onClick={() => setMode('staff-pick-off')}
              className={`rounded border px-3 py-1.5 text-sm ${
                mode === 'staff-pick-off'
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                  : 'border-[#30363d] hover:bg-[#21262d]'
              }`}
            >
              إزالة التمييز
            </button>
          </div>

          {mode ? (
            <div className="space-y-2">
              <p className="text-xs text-[#8b949e]">
                لا تنفيذ جماعي أعمى — كل مشروع يمرّ بمعاينته وسببه وتنفيذه المستقل عبر القناة المحكومة.
                نفّذ كلاً على حدة:
              </p>
              <ul className="space-y-1.5">
                {selected.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded border border-[#30363d] bg-[#0d1117] px-3 py-2"
                  >
                    <span className="truncate text-sm">{p.titleAr}</span>
                    {mode === 'hide' ? (
                      <OpRunner
                        opKey="moderation.project.hide"
                        input={{ projectId: p.id }}
                        triggerLabel="إخفاء"
                        variant="danger"
                        requiresReason
                        riskTier="STANDARD"
                      />
                    ) : (
                      <OpRunner
                        opKey="projects.staff-pick.set"
                        input={{ projectId: p.id, value: mode === 'staff-pick-on' }}
                        triggerLabel={mode === 'staff-pick-on' ? 'تمييز' : 'إزالة'}
                        variant="ghost"
                        requiresReason={false}
                        riskTier="STANDARD"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
