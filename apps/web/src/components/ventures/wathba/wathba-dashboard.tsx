import Link from 'next/link';

import type { ApiMyProject } from '@/lib/api/wathba';
import { formatSar } from '@/lib/i18n/format';
import { PROJECT_STATUS_AR, projectRowHref } from './wathba-account-nav';
import styles from './wathba-dashboard.module.css';

/** Account landing: real applications and projects, not a second campaign dashboard. */
export function WathbaDashboard({ myProjects }: { myProjects: ApiMyProject[] | null }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>مساحة صاحب المشروع</p><h1>مشاريعي وطلباتي</h1>
          <p>تابع طلبك، واستكمل التجهيز، ثم انتقل إلى إدارة مشروعك.</p></div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link className={styles.secondary} href="/projects/dashboard/collaborations">مساحات أشارك فيها</Link>
          <Link className={styles.secondary} href="/projects/me/pledges">تعهداتي كداعم</Link>
        </div>
      </header>
      {myProjects === null ? (
        <section className={styles.card} role="alert"><h2>تعذّر تحميل مشاريعك</h2>
          <p>لم نتمكن من جلب البيانات. أعد المحاولة لعرض طلباتك وحالتها.</p>
          <Link className={styles.primary} href="/projects/dashboard" prefetch={false}>إعادة المحاولة</Link></section>
      ) : myProjects.length === 0 ? (
        <section className={styles.card}><h2>ابدأ بطلب مشروعك</h2><p>قدّم فكرتك للشركة لمراجعتها. ستظهر هنا حالة الطلب والخطوة التالية.</p>
          <Link className={styles.primary} href="/projects/submit">تقديم طلب</Link></section>
      ) : (
        <ul className={styles.list} aria-label="مشاريعي وطلباتي">
          {myProjects.map((project) => {
            const preparing = Boolean(project.applicationApprovedAt);
            const prelaunch = project.status === 'DRAFT' || project.status === 'UNDER_REVIEW';
            const rejected = project.status === 'DRAFT' && Boolean(project.reviewFeedback);
            const label = prelaunch && preparing ? (project.status === 'UNDER_REVIEW' ? 'بانتظار موافقة النشر' : 'تجهيز المشروع')
              : rejected ? 'يحتاج تعديلات' : PROJECT_STATUS_AR[project.status] ?? project.status;
            const action = preparing && prelaunch ? 'فتح مساحة التجهيز' : rejected || project.status === 'UNDER_REVIEW' ? 'متابعة الطلب'
              : project.status === 'DRAFT' ? 'استكمال المسودة' : 'إدارة المشروع';
            return <li key={project.id} className={styles.card}>
              <span className={styles.badge}>{label}</span><h2>{project.titleAr}</h2>
              {prelaunch ? <p>{preparing ? 'اعتُمد طلبك. تبقى الحملة خاصة حتى موافقة الشركة على النشر.'
                : rejected ? project.reviewFeedback : project.status === 'UNDER_REVIEW' ? 'طلبك لدى فريق المراجعة. ستظهر هنا نتيجة المراجعة.'
                  : 'مسودتك محفوظة؛ استكملها وأرسلها للمراجعة.'}</p>
                : <dl className={styles.stats}><div><dt>إجمالي التعهدات</dt><dd>{formatSar('ar', Number(project.raisedHalalas) / 100)}</dd></div>
                  <div><dt>الداعمون</dt><dd>{project.backersCount}</dd></div></dl>}
              <Link className={styles.primary} href={projectRowHref(project)}>{action}</Link>
            </li>;
          })}
        </ul>
      )}
    </main>
  );
}
