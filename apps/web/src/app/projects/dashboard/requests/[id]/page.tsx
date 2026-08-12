import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getMe, getProjectDetail } from '@/lib/api/wathba';

export const metadata: Metadata = { title: 'حالة الطلب · وثبة' };
export const dynamic = 'force-dynamic';

/**
 * Batch ACCOUNT §4.1 — the status tracker for a submitted-but-not-approved
 * project, and the rejection notice.
 *
 * Lives OUTSIDE /projects/dashboard/[id] on purpose: that layout redirects
 * unreviewed projects here, so nesting this inside it would loop.
 *
 * REJECTION IS NOT A STATUS in this schema. A rejected project sits in DRAFT
 * with reviewFeedback set (appeals.service.ts:199, confirmed in the audit), so
 * "rejected" is detected here as that pair — not as a status nobody wrote.
 */
export default async function RequestStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [me, project] = await Promise.all([getMe(), getProjectDetail(id)]);
  if (!project) notFound();
  if (!me || me.id !== project.createdBy) redirect('/projects/dashboard');

  const rejected = project.status === 'DRAFT' && Boolean(project.reviewFeedback);
  const underReview = project.status === 'UNDER_REVIEW';
  // Anything else already has a dashboard — send it there rather than showing
  // a tracker for a decision that has been made.
  if (!rejected && !underReview) redirect(`/projects/dashboard/${encodeURIComponent(project.id)}`);

  return (
    <WathbaShell>
      <section style={{ maxWidth: 620, margin: '0 auto', padding: '32px 16px 64px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--muted2)', margin: '0 0 6px' }}>حالة الطلب</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 18px' }}>{project.titleAr}</h1>

        {underReview && (
          <div style={{ border: '1px solid rgba(var(--ink-rgb),.12)', borderRadius: 14, padding: '18px 20px' }}>
            <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>قيد المراجعة</p>
            <p style={{ fontSize: 13.5, color: 'var(--muted2)', lineHeight: 1.9, margin: 0 }}>
              يراجع الفريق مشروعك الآن. ستصلك رسالة فور صدور القرار، ولا حاجة لإعادة الإرسال.
              لوحة المشروع تُفتح بعد الاعتماد.
            </p>
          </div>
        )}

        {rejected && (
          <div style={{ border: '1px solid rgba(220,38,38,.35)', borderRadius: 14, padding: '18px 20px' }}>
            <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 6px', color: 'var(--err,#dc2626)' }}>لم يُعتمد المشروع</p>
            <p style={{ fontSize: 13.5, color: 'var(--muted2)', lineHeight: 1.9, margin: '0 0 12px' }}>
              {project.reviewFeedback}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href={`/projects/submit?draft=${encodeURIComponent(project.id)}`} style={{ background: 'var(--grad)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 13.5, padding: '9px 18px', borderRadius: 11, textDecoration: 'none' }}>
                عدّل وأعد الإرسال
              </Link>
              <Link href="/appeal" style={{ border: '1px solid rgba(var(--ink-rgb),.14)', color: 'var(--text-soft)', fontWeight: 600, fontSize: 13.5, padding: '9px 18px', borderRadius: 11, textDecoration: 'none' }}>
                تقديم تظلّم
              </Link>
            </div>
          </div>
        )}
      </section>
    </WathbaShell>
  );
}
