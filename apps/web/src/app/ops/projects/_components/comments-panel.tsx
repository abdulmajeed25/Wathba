'use client';

import { ActorName } from '../../_components/actor-name';
import { StatusBadge } from '../../_components/badge';
import { OpRunner } from '../../_components/op-runner';

/**
 * OPS-360 Unit 3 — a project's comments with INLINE moderation. Each row shows
 * the masked author (<ActorName>), a snippet, and the report/hidden flags, plus
 * the governed moderation.comment.moderate OpRunner (hide / dismiss / unhide),
 * so an operator moderates a project's discussion without leaving the workspace.
 */

export interface CommentRow {
  id: string;
  projectId: string;
  author: { id: string; name: string | null; email: string };
  bodyAr: string | null;
  hidden: boolean;
  pinned: boolean;
  likeCount: number;
  reportCount: number;
  parentId: string | null;
  createdAt: string | null;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export function CommentsPanel({ rows }: { rows: CommentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-[#30363d] bg-[#161b22] px-4 py-6 text-center text-sm text-[#8b949e]">
        لا تعليقات على هذا المشروع
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((c) => (
        <li
          key={c.id}
          className="space-y-2 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ActorName id={c.author.id} className="font-bold" />
            <span className="font-mono text-[11px] text-[#8b949e]" dir="ltr">
              {c.author.email}
            </span>
            <span className="text-xs text-[#8b949e]">· {fmtDate(c.createdAt)}</span>
            {c.pinned ? <StatusBadge intent="info">مثبَّت</StatusBadge> : null}
            {c.hidden ? <StatusBadge intent="danger">مخفي</StatusBadge> : null}
            {c.reportCount > 0 ? (
              <StatusBadge intent="warn">{c.reportCount.toLocaleString('ar-SA')} بلاغ</StatusBadge>
            ) : null}
          </div>

          <p className={c.hidden ? 'text-[#8b949e] line-through' : ''}>{c.bodyAr ?? '—'}</p>

          <div className="flex flex-wrap gap-2">
            {c.hidden ? (
              <OpRunner
                opKey="moderation.comment.moderate"
                input={{ commentId: c.id, action: 'unhide' }}
                triggerLabel="إعادة الإظهار"
                variant="ghost"
                requiresReason={false}
                riskTier="STANDARD"
              />
            ) : (
              <OpRunner
                opKey="moderation.comment.moderate"
                input={{ commentId: c.id, action: 'hide' }}
                triggerLabel="إخفاء"
                variant="danger"
                requiresReason={false}
                riskTier="STANDARD"
              />
            )}
            {c.reportCount > 0 ? (
              <OpRunner
                opKey="moderation.comment.moderate"
                input={{ commentId: c.id, action: 'dismiss' }}
                triggerLabel="تجاهل البلاغات"
                variant="ghost"
                requiresReason={false}
                riskTier="STANDARD"
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
