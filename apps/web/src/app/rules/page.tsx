import type { Metadata } from 'next';
import Link from 'next/link';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { Icon } from '@/components/ventures/wathba/wathba-icons';
import { listRules } from '@/lib/api/wathba';

export const metadata: Metadata = {
  title: 'قواعدنا · وثبة',
  description:
    'قواعد النشر على وثبة: ما الذي يجعل المشروع مقبولاً، ما يلتزم به المبدع، المواد المحظورة، سياسة الذكاء الاصطناعي، وكيف تُطبَّق القواعد.',
  openGraph: {
    title: 'قواعدنا · وثبة',
    description: 'القواعد التي تحكم النشر والدعم على وثبة، ولماذا.',
    type: 'website',
  },
};

/** ISR — the rules are ops-editable, so the page must pick up an edit without a deploy. */
export const revalidate = 300;

export default async function RulesHubPage() {
  const rules = await listRules();

  return (
    <WathbaShell>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '46px 26px 80px' }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '.08em',
            color: 'var(--accent-ink)',
            marginBottom: 10,
          }}
        >
          OUR RULES · قواعدنا
        </p>
        <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.35, marginBottom: 14 }}>قواعدنا</h1>
        <p
          style={{
            fontSize: 16,
            color: 'var(--text-soft)',
            lineHeight: 1.9,
            maxWidth: 640,
            marginBottom: 34,
          }}
        >
          وثبة منصة تمويل جماعي بالمكافآت. هذه الصفحات تشرح ما الذي يُنشر هنا وما لا يُنشر،
          وما يلتزم به المبدع تجاه من دعمه، وكيف تُطبَّق القواعد حين تُخالَف — بلغة صريحة
          ومع سبب لكل قاعدة.
        </p>

        {/* The table of contents IS the hub: five pages, each with what it covers. */}
        <nav aria-label="فهرس القواعد" style={{ display: 'grid', gap: 12 }}>
          {rules.map((r, i) => (
            <Link
              key={r.slug}
              href={`/rules/${r.slug.replace(/^rules-/, '')}`}
              data-testid="rules-toc-link"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                background: 'var(--card)',
                border: '1px solid rgba(var(--ink-rgb),.08)',
                borderRadius: 16,
                padding: '18px 20px',
                boxShadow: 'var(--card-shadow)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: 'rgba(var(--accent-rgb),.12)',
                  color: 'var(--accent-ink)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                  {r.titleAr}
                </span>
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.7, color: 'var(--muted)' }}>
                  {r.bodyAr}
                </span>
              </span>
              <Icon name="chevron_left" size={18} color="var(--muted2)" />
            </Link>
          ))}
        </nav>

        {rules.length === 0 && (
          <p style={{ fontSize: 15, color: 'var(--muted)' }}>
            تعذّر تحميل القواعد حالياً. حدّث الصفحة بعد قليل.
          </p>
        )}
      </div>
    </WathbaShell>
  );
}
