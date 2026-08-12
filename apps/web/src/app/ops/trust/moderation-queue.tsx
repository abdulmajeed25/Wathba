'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ActorName } from '../_components/actor-name';
import { StatusBadge } from '../_components/badge';
import { BulkBar } from '../_components/bulk-bar';
import { DataTable, type Column } from '../_components/data-table';
import { OpRunner } from '../_components/op-runner';

/**
 * OPS-360 Unit 3 — «الثقة والسلامة» moderation surface (client island).
 *
 * This REPLACES the old blind "paste an id" cards. Both datasets are fetched
 * server-side from the moderation-only read endpoints (moderation/reports +
 * moderation/comments?reported=true) — never /ops/projects, which the
 * MODERATOR role (analytics.read + moderation.queue) cannot read — and handed
 * here as plain rows. Every subject an operator acts on is a REAL row:
 *
 *   • Reports tab   → per-report governed OpRunners keyed to the report kind
 *                     (project → hide/unhide + dismiss; comment → moderate).
 *   • Comments tab  → the reported-comments browser, with moderate ops AND
 *                     ban/unban of the comment's (real) author id via ActorName.
 *
 * DataTable power features (tableKey column-persist + gear, savedViews, CSV,
 * sortable headers, governed BulkBar) are all wired. Every mutation is a
 * governed <OpRunner> / <BulkBar> — no blind execution, no raw id paste.
 */

export interface TrustReportRow {
  id: string;
  kind: 'project' | 'comment';
  subjectId: string;
  subjectTitleAr: string | null;
  subjectSnippet: string | null;
  reporterMasked: string | null;
  reasonAr: string | null;
  subjectHiddenAt: string | null;
  createdAt: string | null;
}

export interface TrustCommentRow {
  id: string;
  projectId: string;
  author: { id: string; name: string | null; email: string | null };
  bodyAr: string | null;
  hidden: boolean;
  pinned: boolean;
  likeCount: number;
  reportCount: number;
  parentId: string | null;
  createdAt: string | null;
}

const arDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function KindBadge({ kind }: { kind: TrustReportRow['kind'] }) {
  return kind === 'project' ? (
    <StatusBadge intent="info">مشروع</StatusBadge>
  ) : (
    <StatusBadge intent="warn">تعليق</StatusBadge>
  );
}

/* ── Reports queue ──────────────────────────────────────────────────────── */

function reportColumns(): Column<TrustReportRow>[] {
  return [
    {
      key: 'kind',
      label: 'النوع',
      sortable: true,
      csv: (r) => r.kind,
      render: (r) => <KindBadge kind={r.kind} />,
    },
    {
      key: 'subject',
      label: 'المُبلَّغ عنه',
      csv: (r) => r.subjectTitleAr ?? r.subjectSnippet ?? r.subjectId,
      render: (r) =>
        r.kind === 'project' ? (
          <Link
            href={`/ops/projects/${r.subjectId}`}
            className="text-[#58a6ff] hover:underline"
          >
            {r.subjectTitleAr ?? r.subjectId}
          </Link>
        ) : (
          <span className="block max-w-[22rem] truncate" title={r.subjectSnippet ?? undefined}>
            {r.subjectSnippet ?? <code dir="ltr" className="text-xs text-[#8b949e]">{r.subjectId}</code>}
          </span>
        ),
    },
    {
      key: 'reporterMasked',
      label: 'المُبلِّغ',
      // API pre-masks the reporter id (8-char prefix), so it is NOT a resolvable
      // full user id — render the mask verbatim rather than through <ActorName>.
      render: (r) =>
        r.reporterMasked ? (
          <code dir="ltr" className="text-xs text-[#8b949e]" title="مُعرّف مُقنّع">
            {r.reporterMasked}
          </code>
        ) : (
          <span className="text-[#484f58]">نظام</span>
        ),
    },
    {
      key: 'reasonAr',
      label: 'السبب',
      render: (r) => r.reasonAr ?? <span className="text-[#484f58]">—</span>,
    },
    {
      key: 'state',
      label: 'الحالة',
      render: (r) =>
        r.subjectHiddenAt ? <StatusBadge intent="danger">مخفيّ</StatusBadge> : <span className="text-[#484f58]">ظاهر</span>,
    },
    {
      key: 'createdAt',
      label: 'تاريخ البلاغ',
      sortable: true,
      sortValue: (r) => r.createdAt ?? '',
      csv: (r) => r.createdAt ?? '',
      render: (r) => <span className="text-xs text-[#8b949e]">{arDate(r.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'الإشراف',
      render: (r) =>
        r.kind === 'project' ? (
          <div className="flex flex-wrap gap-2">
            {r.subjectHiddenAt ? (
              <OpRunner
                opKey="moderation.project.unhide"
                input={{ projectId: r.subjectId }}
                triggerLabel="إظهار"
                requiresReason={false}
                riskTier="STANDARD"
                variant="ghost"
              />
            ) : (
              <OpRunner
                opKey="moderation.project.hide"
                input={{ projectId: r.subjectId }}
                triggerLabel="إخفاء"
                requiresReason
                riskTier="STANDARD"
                variant="danger"
              />
            )}
            <OpRunner
              opKey="moderation.project-reports.dismiss"
              input={{ projectId: r.subjectId }}
              triggerLabel="رفض البلاغات"
              requiresReason={false}
              riskTier="STANDARD"
              variant="ghost"
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <OpRunner
              opKey="moderation.comment.moderate"
              input={{ commentId: r.subjectId, action: 'hide' }}
              triggerLabel="إخفاء"
              requiresReason={false}
              riskTier="STANDARD"
              variant="danger"
            />
            <OpRunner
              opKey="moderation.comment.moderate"
              input={{ commentId: r.subjectId, action: 'unhide' }}
              triggerLabel="إظهار"
              requiresReason={false}
              riskTier="STANDARD"
              variant="ghost"
            />
            <OpRunner
              opKey="moderation.comment.moderate"
              input={{ commentId: r.subjectId, action: 'dismiss' }}
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

/* ── Reported-comments browser ──────────────────────────────────────────── */

function commentColumns(): Column<TrustCommentRow>[] {
  return [
    {
      key: 'author',
      label: 'الكاتب',
      csv: (c) => c.author.name ?? c.author.id,
      render: (c) => <ActorName id={c.author.id} />,
    },
    {
      key: 'bodyAr',
      label: 'التعليق',
      csv: (c) => c.bodyAr ?? '',
      render: (c) => (
        <span className="block max-w-[26rem] truncate" title={c.bodyAr ?? undefined}>
          {c.bodyAr ?? <span className="text-[#484f58]">—</span>}
        </span>
      ),
    },
    {
      key: 'project',
      label: 'المشروع',
      render: (c) => (
        <Link href={`/ops/projects/${c.projectId}`} className="text-[#58a6ff] hover:underline">
          فتح
        </Link>
      ),
    },
    {
      key: 'hidden',
      label: 'الحالة',
      sortable: true,
      sortValue: (c) => (c.hidden ? 1 : 0),
      csv: (c) => (c.hidden ? 'hidden' : 'visible'),
      render: (c) =>
        c.hidden ? <StatusBadge intent="danger">مخفيّ</StatusBadge> : <span className="text-[#484f58]">ظاهر</span>,
    },
    {
      key: 'reportCount',
      label: 'البلاغات',
      align: 'center',
      sortable: true,
      sortValue: (c) => c.reportCount,
      render: (c) => (
        <span className={`tabular-nums ${c.reportCount > 0 ? 'font-bold text-amber-300' : 'text-[#8b949e]'}`}>
          {c.reportCount.toLocaleString('ar-SA-u-nu-latn')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'التاريخ',
      sortable: true,
      sortValue: (c) => c.createdAt ?? '',
      csv: (c) => c.createdAt ?? '',
      render: (c) => <span className="text-xs text-[#8b949e]">{arDate(c.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'الإشراف',
      render: (c) => (
        <div className="flex flex-wrap gap-2">
          {c.hidden ? (
            <OpRunner
              opKey="moderation.comment.moderate"
              input={{ commentId: c.id, action: 'unhide' }}
              triggerLabel="إظهار"
              requiresReason={false}
              riskTier="STANDARD"
              variant="ghost"
            />
          ) : (
            <OpRunner
              opKey="moderation.comment.moderate"
              input={{ commentId: c.id, action: 'hide' }}
              triggerLabel="إخفاء"
              requiresReason={false}
              riskTier="STANDARD"
              variant="danger"
            />
          )}
          <OpRunner
            opKey="moderation.comment.moderate"
            input={{ commentId: c.id, action: 'dismiss' }}
            triggerLabel="رفض البلاغات"
            requiresReason={false}
            riskTier="STANDARD"
            variant="ghost"
          />
          <OpRunner
            opKey="moderation.user.ban"
            input={{ userId: c.author.id }}
            triggerLabel="حظر الكاتب"
            requiresReason
            riskTier="SENSITIVE"
            variant="danger"
          />
          <OpRunner
            opKey="moderation.user.unban"
            input={{ userId: c.author.id }}
            triggerLabel="رفع الحظر"
            requiresReason
            riskTier="SENSITIVE"
            variant="ghost"
          />
        </div>
      ),
    },
  ];
}

/* ── Tabbed shell ───────────────────────────────────────────────────────── */

type Tab = 'reports' | 'comments';

export function ModerationQueue({
  reports,
  comments,
  initialTab = 'reports',
}: {
  reports: TrustReportRow[];
  comments: TrustCommentRow[];
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabBtn = (id: Tab, labelAr: string, count: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`rounded-t border-b-2 px-4 py-2 text-sm font-bold transition-colors ${
        tab === id
          ? 'border-emerald-500 text-[#e6edf3]'
          : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'
      }`}
    >
      {labelAr}
      <span className="ms-2 rounded bg-[#21262d] px-1.5 py-0.5 text-xs tabular-nums text-[#8b949e]">
        {count.toLocaleString('ar-SA-u-nu-latn')}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="أقسام الإشراف" className="flex flex-wrap gap-1 border-b border-[#21262d]">
        {tabBtn('reports', 'البلاغات المفتوحة', reports.length)}
        {tabBtn('comments', 'تعليقات مُبلَّغ عنها', comments.length)}
      </div>

      {tab === 'reports' ? (
        <section role="tabpanel" aria-label="البلاغات المفتوحة" className="space-y-3">
          <DataTable
            columns={reportColumns()}
            rows={reports}
            emptyAr="لا بلاغات مفتوحة"
            minWidth={960}
            selectable
            tableKey="trust-reports"
            savedViews
            csvFileName="moderation-reports"
            csvLabelAr="تصدير البلاغات"
            bulk={({ rows, clear }) => (
              <BulkBar
                rows={rows}
                onClear={clear}
                labelForRow={(r) => r.subjectTitleAr ?? r.subjectSnippet ?? r.subjectId}
                ops={[
                  {
                    opKey: 'moderation.project-reports.dismiss',
                    label: 'رفض بلاغات المشاريع',
                    applicable: (r) => r.kind === 'project',
                    input: (r) => ({ projectId: r.subjectId }),
                    riskTier: 'STANDARD',
                    variant: 'ghost',
                    describeAr: 'يرفض كل البلاغات المفتوحة على المشاريع المحددة (يُبقيها ظاهرة).',
                  },
                  {
                    opKey: 'moderation.project.hide',
                    label: 'إخفاء المشاريع',
                    applicable: (r) => r.kind === 'project' && !r.subjectHiddenAt,
                    input: (r) => ({ projectId: r.subjectId }),
                    riskTier: 'STANDARD',
                    requiresReason: true,
                    variant: 'danger',
                    describeAr: 'يُخفي المشاريع المحددة من كل القراءات العامة.',
                  },
                  {
                    opKey: 'moderation.comment.moderate',
                    label: 'إخفاء التعليقات',
                    applicable: (r) => r.kind === 'comment',
                    input: (r) => ({ commentId: r.subjectId, action: 'hide' }),
                    riskTier: 'STANDARD',
                    variant: 'danger',
                    describeAr: 'يُخفي التعليقات المُبلَّغ عنها المحددة.',
                  },
                ]}
              />
            )}
          />
        </section>
      ) : (
        <section role="tabpanel" aria-label="تعليقات مُبلَّغ عنها" className="space-y-3">
          <p className="text-xs text-[#8b949e]">
            تعليقات لديها بلاغ واحد على الأقل (reportCount &gt; 0) — الكاتب مُعرَّف عبر ActorName،
            وكل إجراء عملية محكومة.
          </p>
          <DataTable
            columns={commentColumns()}
            rows={comments}
            emptyAr="لا تعليقات مُبلَّغ عنها"
            minWidth={960}
            selectable
            tableKey="trust-comments"
            savedViews
            csvFileName="moderation-comments"
            csvLabelAr="تصدير التعليقات"
            bulk={({ rows, clear }) => (
              <BulkBar
                rows={rows}
                onClear={clear}
                labelForRow={(c) => c.author.name ?? c.id}
                ops={[
                  {
                    opKey: 'moderation.comment.moderate',
                    label: 'إخفاء',
                    applicable: (c) => !c.hidden,
                    input: (c) => ({ commentId: c.id, action: 'hide' }),
                    riskTier: 'STANDARD',
                    variant: 'danger',
                    describeAr: 'يُخفي التعليقات المحددة الظاهرة.',
                  },
                  {
                    opKey: 'moderation.comment.moderate',
                    label: 'إظهار',
                    applicable: (c) => c.hidden,
                    input: (c) => ({ commentId: c.id, action: 'unhide' }),
                    riskTier: 'STANDARD',
                    variant: 'ghost',
                    describeAr: 'يُعيد إظهار التعليقات المحددة المخفية.',
                  },
                  {
                    opKey: 'moderation.comment.moderate',
                    label: 'رفض البلاغات',
                    input: (c) => ({ commentId: c.id, action: 'dismiss' }),
                    riskTier: 'STANDARD',
                    variant: 'ghost',
                    describeAr: 'يمسح بلاغات التعليقات المحددة دون إخفائها.',
                  },
                ]}
              />
            )}
          />
        </section>
      )}
    </div>
  );
}
