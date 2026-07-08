import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { adaptApiVenture } from '@/components/ventures/wathba/wathba-data';
import { WathbaCampaign } from '@/components/ventures/wathba/wathba-campaign';
import { WathbaProjectsRail } from '@/components/ventures/wathba/wathba-similar-rail';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getProjectDetail, getSimilarProjects, listVentures } from '@/lib/api/wathba';

/**
 * STAKES/N6 — human-readable campaign URLs: /p/[slug] (the API detail
 * endpoint accepts slug OR UUID, so a UUID pasted here still resolves).
 * Renders the same campaign surface as /projects/[id]; the canonical URL
 * for a slugged project is THIS route on both pages (no duplicate content).
 */

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const live = await getProjectDetail(slug).catch(() => null);
  if (!live) return { title: 'مشروع غير موجود · وثبة' };
  const title = `${live.titleAr} · وثبة`;
  const description = live.metaDescription ?? live.shortDescAr;
  const ogImage = live.ogImage ?? live.mediaUrls?.[0] ?? undefined;
  const canonical = live.slug ? `/p/${live.slug}` : `/projects/${live.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonical,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

export default async function ProjectBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await getProjectDetail(slug).catch(() => null);
  if (!detail) notFound();

  const live = await listVentures();
  const apiRow = live?.find((v) => v.id === detail.id);
  const liveProject = apiRow ? adaptApiVenture(apiRow) : null;
  const paused = detail.status === 'PAUSED';
  const similar = await getSimilarProjects(detail.id).catch(() => []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: detail.titleAr,
    description: detail.metaDescription ?? detail.shortDescAr,
    url: detail.slug ? `/p/${detail.slug}` : `/projects/${detail.id}`,
    ...(detail.ogImage || detail.mediaUrls?.[0]
      ? { image: detail.ogImage ?? detail.mediaUrls[0] }
      : {}),
    datePublished: detail.publishedAt ?? undefined,
    inLanguage: 'ar',
  };

  return (
    <WathbaShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {paused && (
        <div
          dir="rtl"
          style={{
            maxWidth: 1120, margin: '0 auto 4px', padding: '10px 18px', borderRadius: 12,
            background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.4)',
            color: '#a96400', fontSize: 13.5, fontWeight: 700, textAlign: 'center',
          }}
        >
          ⏸ هذه الحملة موقوفة مؤقتاً — الدعم الجديد متوقف حالياً.
        </div>
      )}
      <WathbaCampaign id={detail.id} project={liveProject ?? undefined} />
      {/* STAKES/J3 — same-subcategory rail. */}
      <WathbaProjectsRail title="مشاريع مشابهة" projects={similar} />
    </WathbaShell>
  );
}
