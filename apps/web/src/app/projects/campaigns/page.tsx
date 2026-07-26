import type { Metadata } from 'next';
import Link from 'next/link';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { listActiveCollections } from '@/lib/api/wathba';

export const metadata: Metadata = {
  title: 'حملات وثبة · كيف تنضم',
  description: 'تعرّف على حملات وثبة المنسّقة وكيف يظهر مشروعك ضمنها.',
};
export const revalidate = 300;

/** Batch DISC / Part 4 — the "انضم إلى حملة" explainer (how collections work). */
export default async function CampaignsPage() {
  const active = (await listActiveCollections()) ?? [];
  return (
    <WathbaShell>
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 26px 80px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 10 }}>حملات وثبة</h1>
        <p style={{ fontSize: 15.5, color: 'var(--muted)', lineHeight: 1.9, marginBottom: 28 }}>
          حملات وثبة هي مجموعات منسّقة من المشاريع تجمعها فرق وثبة حول موضوع أو موسم أو هدف وطني
          يتماشى مع رؤية المملكة ٢٠٣٠ — مثل «اصنع في السعودية» و«مشاريع التخرّج». تساعد الحملات
          الداعمين على اكتشاف مشاريع مختارة بعناية، وتمنح المشاريع المشاركة ظهوراً إضافياً.
        </p>

        <Section title="كيف تعمل الحملات">
          <ul style={ulStyle}>
            <li>ينشئ فريق وثبة الحملة ويكتب وصفها ويحدد معاييرها.</li>
            <li>تُرشَّح المشاريع المناسبة وتُضاف إلى الحملة من قبل الفريق.</li>
            <li>تظهر الحملة النشطة في صفحة «اكتشف» وضمن عوامل التصفية الجانبية.</li>
            <li>يمكن تصفية المشاريع حسب الحملة عبر رابط قابل للمشاركة.</li>
          </ul>
        </Section>

        <Section title="كيف يظهر مشروعك ضمن حملة">
          <ul style={ulStyle}>
            <li>أطلق مشروعاً مكتملاً وواضحاً يلبّي معايير الجودة على وثبة.</li>
            <li>اختر الفئة والموقع المناسبين حتى يسهل ترشيح مشروعك.</li>
            <li>تابع إعلانات المواسم والحملات الجديدة من فريق وثبة.</li>
            <li>الترشيح والإضافة يتمّان من قبل فريق وثبة — لا حاجة لطلب مباشر.</li>
          </ul>
        </Section>

        {active.length > 0 && (
          <Section title="الحملات النشطة الآن">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {active.map((c) => (
                <Link
                  key={c.slug}
                  href={`/projects/discover-all?collection=${c.slug}`}
                  style={{
                    display: 'block',
                    padding: '16px 18px',
                    borderRadius: 14,
                    background: 'var(--card)',
                    border: '1px solid rgba(var(--ink-rgb),.09)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{c.nameAr}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--muted2)', lineHeight: 1.7 }}>{c.descriptionAr}</div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        <div style={{ marginTop: 34 }}>
          <Link
            href="/projects/discover-all"
            style={{
              display: 'inline-block',
              background: 'var(--grad)',
              color: 'var(--on-accent)',
              fontWeight: 700,
              fontSize: 14.5,
              padding: '12px 24px',
              borderRadius: 13,
              textDecoration: 'none',
            }}
          >
            تصفّح كل المشاريع
          </Link>
        </div>
      </main>
    </WathbaShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

const ulStyle: React.CSSProperties = {
  margin: 0,
  paddingInlineStart: 22,
  display: 'flex',
  flexDirection: 'column',
  gap: 9,
  fontSize: 14.5,
  color: 'var(--text-soft)',
  lineHeight: 1.8,
};
