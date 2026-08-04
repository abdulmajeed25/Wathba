import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import {
  WathbaStoryMarkdown,
  storyHeadingId,
} from '@/components/ventures/wathba/wathba-story-markdown';
import { parseStory } from '@/lib/story/parse-story';
import { getStory, listRules } from '@/lib/api/wathba';

/**
 * A rules page is an EditorialCard of kind RULE, so it is edited through the
 * same audited ops CONTENT surface as any other article and needs no deploy.
 * The public slug drops the `rules-` prefix that keeps the cards grouped in the
 * console — `/rules/prohibited` reads better than `/rules/rules-prohibited`.
 */
const toCardSlug = (slug: string): string => `rules-${slug}`;

export const revalidate = 300;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const rules = await listRules();
  return rules.map((r) => ({ slug: r.slug.replace(/^rules-/, '') }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const card = await getStory(toCardSlug(slug));
  if (!card) return { title: 'صفحة غير موجودة · وثبة' };
  return {
    title: `${card.titleAr} · قواعد وثبة`,
    description: card.bodyAr.slice(0, 160),
    openGraph: { title: `${card.titleAr} · قواعد وثبة`, description: card.bodyAr.slice(0, 160), type: 'article' },
  };
}

export default async function RulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getStory(toCardSlug(slug));
  if (!card || !card.bodyLongAr) notFound();

  const nodes = parseStory(card.bodyLongAr);
  // Only h2 carries a section anchor. h3 exists inside long sections and would
  // make the contents list longer than the page it indexes.
  const sections: Array<{ text: string; i: number }> = nodes.flatMap((n, i) =>
    n.kind === 'h2' ? [{ text: n.text, i }] : [],
  );

  return (
    <WathbaShell>
      {/* WathbaShell already renders <main>; a second one is two main
          landmarks on the page, which is an a11y violation. */}
      <div
        className="wathba-rules-page"
        style={{ maxWidth: 780, margin: '0 auto', padding: '40px 26px 80px' }}
      >
        <nav aria-label="مسار التنقل" style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
          <Link href="/rules" style={{ color: 'var(--accent-ink)', textDecoration: 'none' }}>
            قواعدنا
          </Link>
          <span aria-hidden> ← </span>
          <span>{card.titleAr}</span>
        </nav>

        <article>
          <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.35, marginBottom: 12 }}>
            {card.titleAr}
          </h1>
          <p
            style={{
              fontSize: 15.5,
              color: 'var(--text-soft)',
              lineHeight: 1.85,
              marginBottom: 26,
              borderInlineStart: '3px solid var(--accent)',
              paddingInlineStart: 14,
            }}
          >
            {card.bodyAr}
          </p>

          {sections.length > 2 && (
            <nav
              aria-label="محتويات الصفحة"
              className="wathba-rules-toc"
              style={{
                background: 'rgba(var(--ink-rgb),.03)',
                border: '1px solid rgba(var(--ink-rgb),.07)',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 30,
              }}
            >
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
                في هذه الصفحة
              </p>
              <ul style={{ display: 'grid', gap: 7, listStyle: 'none', padding: 0, margin: 0 }}>
                {sections.map(({ text, i }) => (
                  <li key={i}>
                    <a
                      href={`#${storyHeadingId(i)}`}
                      style={{ fontSize: 14.5, color: 'var(--accent-ink)', textDecoration: 'none', lineHeight: 1.7 }}
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <WathbaStoryMarkdown nodes={nodes} />
        </article>

        <footer
          style={{
            marginTop: 40,
            paddingTop: 22,
            borderTop: '1px solid rgba(var(--ink-rgb),.08)',
            fontSize: 14.5,
            color: 'var(--text-soft)',
            lineHeight: 1.9,
          }}
        >
          <p style={{ marginBottom: 8 }}>
            سؤال لم تُجب عنه هذه الصفحة؟{' '}
            <Link href="/projects/help" style={{ color: 'var(--accent-ink)' }}>
              مركز المساعدة
            </Link>{' '}
            يشرح الجانب العملي، ويمكنك مراسلتنا من هناك مباشرة.
          </p>
          <Link href="/rules" style={{ color: 'var(--accent-ink)', fontSize: 14 }}>
            ← كل القواعد
          </Link>
        </footer>
      </div>
    </WathbaShell>
  );
}
