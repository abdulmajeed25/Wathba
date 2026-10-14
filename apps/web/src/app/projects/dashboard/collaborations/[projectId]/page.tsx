import Link from 'next/link';
import { requireUser } from '@/lib/auth/guard';
import { getContentWorkspace } from '@/lib/api/content-workspaces';
import { listProjectUpdates } from '@/lib/api/wathba';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { DashboardUpdatesComposer } from '@/components/ventures/wathba/dashboard/wathba-dashboard-updates-composer';
import styles from '@/components/ventures/wathba/wathba-dashboard.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'مساحة تحرير التحديثات · وثبة' };

export default async function ContentWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireUser();
  const { projectId } = await params;
  const result = await getContentWorkspace(projectId);
  if (!result.ok) {
    if (result.status !== 404 && result.status !== 403) throw new Error('تعذر تحميل مساحة المحتوى');
    return <WathbaShell><div className={styles.page}><section className={styles.card} role="status">
      <h1>مساحة المحتوى غير متاحة</h1><p>قد يكون صاحب الحملة سحب وصولك، أو لم تعد الحملة متاحة للتحرير. تواصل معه للتحقق من عضويتك.</p>
      <Link className={styles.primary} href="/projects/dashboard/collaborations">العودة إلى مساحاتي</Link>
    </section></div></WathbaShell>;
  }
  const updates = await listProjectUpdates(projectId, { take: 100 });
  if (!updates || !Array.isArray(updates.items)) throw new Error('تعذر تحميل تحديثات مساحة المحتوى');
  const preparing = ['DRAFT', 'UNDER_REVIEW'].includes(result.data.status);
  return <WathbaShell><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>محرر تحديثات · {result.data.titleAr}</p>
      <p>تستطيع كتابة التحديثات وجدولتها وتثبيتها وحذفها. إدارة الفريق والهدف والمدة والمال لدى صاحب الحملة وإدارة وثبة.</p></div>
      <Link className={styles.secondary} href="/projects/dashboard/collaborations">كل مساحاتي</Link></header>
    {preparing && <section className={styles.card} role="status"><h2>الحملة في مرحلة التجهيز</h2>
      <p>التحديثات محفوظة داخل مساحة الحملة؛ لا تظهر للجمهور ولا ترسل إشعارات له قبل موافقة النشر.</p></section>}
    <DashboardUpdatesComposer projectId={projectId} initial={updates.items} />
  </div></WathbaShell>;
}
