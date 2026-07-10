import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getStory } from '@/lib/api/wathba';

/**
 * Batch HOME — editorial article page (`/stories/:slug`). Renders the
 * admin-managed long-form Arabic body (bodyLongAr, plain paragraphs split
 * on blank lines; «## » lines become h2). ISR 300 via getStory.
 */

const KIND_EYEBROW: Record<string, string> = {
  SUCCESS_STORY: 'قصة نجاح',
  CREATOR_INTERVIEW: 'حوار مع مبدع',
  RESOURCE: 'ركن المبدعين',
  TIP: 'نصائح التمويل',
  TRUST_GUIDE: 'الثقة والأمان',
  ANNOUNCEMENT: 'إعلان',
  HERO_BANNER: 'من وثبة',
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return { title: 'قصة غير موجودة · وثبة' };
  return { title: `${story.titleAr} · وثبة`, description: story.bodyAr.slice(0, 160) };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story || !story.bodyLongAr) notFound();

  const blocks = story.bodyLongAr
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <WathbaShell>
      <article data-testid="story-article" style={{ maxWidth: 760, margin: '0 auto', padding: '46px 26px 70px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: 'var(--accent-ink)', marginBottom: 10 }}>
          {KIND_EYEBROW[story.kind] ?? 'من وثبة'}
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.35, marginBottom: 14 }}>{story.titleAr}</h1>
        <p style={{ fontSize: 15.5, color: 'var(--text-soft)', lineHeight: 1.8, marginBottom: 28, borderInlineStart: '3px solid var(--accent)', paddingInlineStart: 14 }}>
          {story.bodyAr}
        </p>
        <div style={{ fontSize: 15, lineHeight: 2, color: 'var(--text)' }}>
          {blocks.map((b, i) =>
            b.startsWith('## ') ? (
              <h2 key={i} style={{ fontSize: 20, fontWeight: 700, margin: '26px 0 10px' }}>
                {b.slice(3)}
              </h2>
            ) : (
              <p key={i} style={{ marginBottom: 16 }}>
                {b}
              </p>
            ),
          )}
        </div>
        {story.linkUrl && (
          <Link
            href={story.linkUrl}
            style={{
              display: 'inline-block', marginTop: 24, background: 'var(--grad)', color: 'var(--on-accent)',
              fontWeight: 700, fontSize: 13.5, padding: '12px 24px', borderRadius: 12, textDecoration: 'none',
            }}
          >
            {story.linkLabelAr ?? 'اكتشف المزيد'}
          </Link>
        )}
        <div style={{ marginTop: 34, paddingTop: 20, borderTop: '1px solid rgba(var(--ink-rgb),.08)' }}>
          <Link href="/projects" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none', padding: '6px 0', display: 'inline-block' }}>
            → العودة إلى الرئيسية
          </Link>
        </div>
      </article>
    </WathbaShell>
  );
}
