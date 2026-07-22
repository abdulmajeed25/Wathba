'use client';

import Link from 'next/link';
import { useState } from 'react';

import { StatusBadge } from '../_components/badge';
import { DataTable, type Column } from '../_components/data-table';
import { OpRunner } from '../_components/op-runner';
import { formatSar } from '../_lib/money';

/**
 * OPS Phase 2 — «الثقة والسلامة» moderation surface (client island). The
 * project queue rows are fetched server-side and handed here as plain data;
 * this file owns the per-row moderation OpRunners plus a set of id-targeted
 * ops (comment / user / FAQ) that have no list endpoint yet — the operator
 * pastes the subject id. Every action is a governed <OpRunner>.
 */

export interface TrustProjectRow {
  id: string;
  titleAr: string;
  status: string;
  categoryNameAr: string | null;
  raisedHalalas: string | null;
  backersCount: number;
  createdBy: string | null;
  hiddenAt: string | null;
  createdAt: string;
}

function projectColumns(): Column<TrustProjectRow>[] {
  return [
    {
      key: 'titleAr',
      label: 'المشروع',
      render: (p) => (
        <Link href={`/ops/projects/${p.id}`} className="text-[#58a6ff] hover:underline">
          {p.titleAr}
        </Link>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (p) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge intent="muted">{p.status}</StatusBadge>
          {p.hiddenAt ? <StatusBadge intent="danger">مخفيّ</StatusBadge> : null}
        </span>
      ),
    },
    { key: 'categoryNameAr', label: 'الفئة', render: (p) => p.categoryNameAr ?? '—' },
    {
      key: 'raisedHalalas',
      label: 'المجموع',
      align: 'left',
      render: (p) => <span className="tabular-nums">{formatSar(p.raisedHalalas)}</span>,
    },
    { key: 'backersCount', label: 'الداعمون', align: 'center' },
    {
      key: 'actions',
      label: 'الإشراف',
      render: (p) => (
        <div className="flex flex-wrap gap-2">
          {p.hiddenAt ? (
            <OpRunner
              opKey="moderation.project.unhide"
              input={{ projectId: p.id }}
              triggerLabel="إظهار"
              requiresReason={false}
              riskTier="STANDARD"
              variant="ghost"
            />
          ) : (
            <OpRunner
              opKey="moderation.project.hide"
              input={{ projectId: p.id }}
              triggerLabel="إخفاء"
              requiresReason
              riskTier="STANDARD"
              variant="danger"
            />
          )}
          <OpRunner
            opKey="moderation.project-reports.dismiss"
            input={{ projectId: p.id }}
            triggerLabel="رفض البلاغات"
            requiresReason={false}
            riskTier="STANDARD"
            variant="ghost"
          />
        </div>
      ),
    },
  ];
}

function TargetedCard({
  title,
  hint,
  placeholder,
  children,
}: {
  title: string;
  hint: string;
  placeholder?: string;
  children: (id: string) => React.ReactNode;
}) {
  const [id, setId] = useState('');
  return (
    <div className="rounded-lg border border-[#21262d] bg-[#161b22] p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-0.5 text-xs text-[#8b949e]">{hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={id}
          onChange={(e) => setId(e.target.value.trim())}
          placeholder={placeholder ?? 'المعرّف'}
          dir="ltr"
          aria-label={placeholder ?? 'المعرّف'}
          className="min-w-[20rem] flex-1 rounded border border-[#30363d] bg-[#0d1117] px-3 py-1.5 font-mono text-xs outline-none focus:border-emerald-500"
        />
        {children(id)}
      </div>
    </div>
  );
}

export function ModerationQueue({ projects }: { projects: TrustProjectRow[] }) {
  const [commentAction, setCommentAction] = useState<'hide' | 'unhide' | 'dismiss'>('hide');

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[#8b949e]">طابور المشاريع المُبلَّغ عنها / المُشرَف عليها</h2>
        <DataTable
          columns={projectColumns()}
          rows={projects}
          emptyAr="لا مشاريع في هذا العرض"
          minWidth={880}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[#8b949e]">إشراف مُوجَّه بالمعرّف</h2>
        <p className="text-xs text-[#8b949e]">
          لا توجد نقطة نهاية لقائمة البلاغات المُوحَّدة بعد — تُنفَّذ هذه العمليات بلصق معرّف الهدف.
        </p>

        <TargetedCard
          title="إشراف على تعليق"
          hint="إخفاء / إظهار / رفض البلاغات عن تعليق محدد."
          placeholder="معرّف التعليق (commentId)"
        >
          {(id) => (
            <>
              <label className="inline-flex items-center gap-1 text-xs text-[#8b949e]">
                الإجراء
                <select
                  value={commentAction}
                  onChange={(e) => setCommentAction(e.target.value as typeof commentAction)}
                  aria-label="إجراء التعليق"
                  className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="hide">إخفاء</option>
                  <option value="unhide">إظهار</option>
                  <option value="dismiss">رفض البلاغات</option>
                </select>
              </label>
              <OpRunner
                key={`comment-${id}-${commentAction}`}
                opKey="moderation.comment.moderate"
                input={{ commentId: id, action: commentAction }}
                triggerLabel="تنفيذ"
                requiresReason={false}
                riskTier="STANDARD"
                variant="ghost"
                disabled={id.length < 10}
              />
            </>
          )}
        </TargetedCard>

        <TargetedCard
          title="حظر / رفع حظر مستخدم"
          hint="إجراء إشراف على حساب — يُلغي كل الجلسات النشطة عند الحظر."
          placeholder="معرّف المستخدم (userId)"
        >
          {(id) => (
            <>
              <OpRunner
                key={`ban-${id}`}
                opKey="moderation.user.ban"
                input={{ userId: id }}
                triggerLabel="حظر"
                requiresReason
                riskTier="SENSITIVE"
                variant="danger"
                disabled={id.length < 10}
              />
              <OpRunner
                key={`unban-${id}`}
                opKey="moderation.user.unban"
                input={{ userId: id }}
                triggerLabel="رفع الحظر"
                requiresReason
                riskTier="SENSITIVE"
                variant="ghost"
                disabled={id.length < 10}
              />
            </>
          )}
        </TargetedCard>

        <TargetedCard
          title="إخفاء سؤال شائع"
          hint="إشراف على الأسئلة المُرسلة من المستخدمين (→HIDDEN)."
          placeholder="معرّف السؤال (questionId)"
        >
          {(id) => (
            <OpRunner
              key={`faq-${id}`}
              opKey="faq.question.hide"
              input={{ questionId: id }}
              triggerLabel="إخفاء السؤال"
              requiresReason={false}
              riskTier="STANDARD"
              variant="ghost"
              disabled={id.length < 10}
            />
          )}
        </TargetedCard>
      </section>
    </div>
  );
}
