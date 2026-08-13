import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe, getProjectDetailLive } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'حالة الطلب · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Batch ACCOUNT / U6 — the status tracker for a submitted-but-unreviewed
 * project, and the rejection notice.
 *
 * IT LIVES HERE, OUTSIDE /projects/dashboard/[id], ON PURPOSE. That layout
 * redirects unreviewed projects to this page; nested inside it, the redirect
 * would target itself and loop forever — and the gate would present to a
 * creator as a hang rather than as a refusal. (`requests` is a static segment,
 * so Next resolves it ahead of the sibling `[id]` and this page never inherits
 * that layout.)
 *
 * REJECTION IS NOT A STATUS in this schema. A rejected project sits in DRAFT
 * with reviewFeedback set — confirmed in the audit and stated outright at
 * appeals.service.ts:199 — so "rejected" is detected as that PAIR, not as a
 * status nobody ever writes. U1 added rejectedAt so the cooldown has a date to
 * count from; the reason itself still lives in reviewFeedback.
 *
 * NO APPLICATION MODEL is involved. listMyApplications() was a stub returning
 * null and there is no request/application table; per the owner's decision this
 * reads Project directly.
 */
export default async function RequestStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [me, project] = await Promise.all([getMe(), getProjectDetailLive(id)]);
  if (!project) notFound();
  // Ownership, same as the dashboard: a review decision is private to its author.
  if (!me || me.id !== project.createdBy) redirect('/projects/dashboard');

  const rejected = project.status === 'DRAFT' && Boolean(project.reviewFeedback);
  const underReview = project.status === 'UNDER_REVIEW';
  // Anything else already has a dashboard — send it there rather than showing a
  // tracker for a decision that has been made.
  if (!rejected && !underReview) {
    redirect(`/projects/dashboard/${encodeURIComponent(project.id)}`);
  }

  return (
    <WathbaShell>
      <section className="wathba-request-page">
        <p className="wathba-request-eyebrow">حالة الطلب</p>
        <h1>{project.titleAr}</h1>

        {underReview && (
          <div className="wathba-request-card">
            <strong>قيد المراجعة</strong>
            <p>
              يراجع الفريق مشروعك الآن. ستصلك رسالة فور صدور القرار، ولا حاجة لإعادة الإرسال.
              تُفتح لوحة المشروع بعد الاعتماد.
            </p>
          </div>
        )}

        {rejected && (
          <div className="wathba-request-card is-rejected">
            <strong>لم يُعتمد المشروع</strong>
            {/* The reason is the point of this page. A rejection the creator
                cannot read is a rejection they cannot act on. */}
            <p>{project.reviewFeedback}</p>
            <div className="wathba-request-actions">
              <Link href={`/projects/submit?draft=${encodeURIComponent(project.id)}`} className="is-primary">
                عدّل وأعد الإرسال
              </Link>
              <Link href="/appeal">تقديم تظلّم</Link>
            </div>
          </div>
        )}
      </section>
    </WathbaShell>
  );
}
