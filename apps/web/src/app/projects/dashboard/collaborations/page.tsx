import Link from 'next/link';
import { requireUser } from '@/lib/auth/guard';
import { listContentWorkspaces } from '@/lib/api/content-workspaces';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { PROJECT_STATUS_AR } from '@/components/ventures/wathba/wathba-account-nav';
import styles from '@/components/ventures/wathba/wathba-dashboard.module.css';

export const metadata = { title: 'مساحات أشارك فيها · وثبة' };
export const dynamic = 'force-dynamic';

export default async function ContentWorkspacesPage() {
  await requireUser();
  const result = await listContentWorkspaces();
  if (!result.ok || !Array.isArray(result.data.items)) throw new Error('تعذر تحميل مساحات المحتوى');
  return <WathbaShell><div className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>التعاون على الحملات</p><h1>مساحات أشارك فيها</h1>
        <p>تحديثات الحملات التي أضافك صاحبها إلى فريق التحرير.</p></div>
      <Link className={styles.secondary} href="/projects/dashboard">مشاريعي وطلباتي</Link>
    </header>
    {result.data.items.length === 0 ? <section className={styles.card}><h2>لا توجد مساحات متاحة لك الآن</h2>
      <p>يضيفك صاحب الحملة من إعدادات فريقه باستخدام بريد حسابك في وثبة. تظهر المساحة بعد اعتماد الطلب، وتختفي إذا سُحب وصولك أو أُخفيت الحملة.</p></section>
      : <ul className={styles.list} aria-label="مساحات المحتوى">{result.data.items.map(project => <li className={styles.card} key={project.id}>
        <span className={styles.badge}>محرر تحديثات</span><h2>{project.titleAr}</h2>
        <p>{PROJECT_STATUS_AR[project.status] ?? project.status} · تحرير التحديثات العامة والخاصة وجدولتها.</p>
        <Link className={styles.primary} href={`/projects/dashboard/collaborations/${encodeURIComponent(project.id)}`}>فتح مساحة المحتوى</Link>
      </li>)}</ul>}
  </div></WathbaShell>;
}
