import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import { notFound } from 'next/navigation';

import { adaptApiProjectDetail, adaptApiVenture } from '@/components/ventures/wathba/wathba-data';
import { WathbaCampaignHeader } from '@/components/ventures/wathba/wathba-campaign-header';
import { WathbaCampaignTabBar } from '@/components/ventures/wathba/wathba-campaign-tabbar';
import { WathbaLegacyTabRedirect, WathbaTabStory } from '@/components/ventures/wathba/wathba-tab-story';
import { WathbaProjectsRail } from '@/components/ventures/wathba/wathba-similar-rail';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getProjectDetail, getSimilarProjects, listVentures } from '@/lib/api/wathba';
import { toArabicDigits } from '@/components/ventures/wathba/discover-all-constants';

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
  const baseDescription = live.metaDescription ?? live.shortDescAr;
  // STAKES/S-10 F-04 — funded % on the share card + brand-card image fallback.
  const pct =
    live.fundingGoalHalalas > 0 && (live.status === 'LIVE' || live.status === 'FUNDED')
      ? Math.round((live.raisedHalalas / live.fundingGoalHalalas) * 100)
      : null;
  const description = pct !== null ? `مُموَّل ${toArabicDigits(pct)}٪ · ${baseDescription ?? ''}`.trim() : baseDescription;
  const ogImage = live.ogImage ?? live.mediaUrls?.[0] ?? '/og-default.png';
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
      images: [{ url: ogImage }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
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
  // POLISH — fall back to the API DETAIL, not to a demo fixture. adaptApiVenture
  // can only match a project present in the hardcoded demo table, so for every
  // real project it returned null and resolveCampaign silently rendered
  // wathbaProjects[0] — every campaign page showed «سِرب» as its heading.
  const liveProject = (apiRow ? adaptApiVenture(apiRow) : null) ?? adaptApiProjectDetail(detail);
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
    // STAKES/S-15 (N5) — crowdfunding-appropriate enrichment: the pledge
    // action + backers count (schema.org has no crowdfunding type; this is
    // the documented pattern for donation-style campaigns).
    potentialAction: {
      '@type': 'DonateAction',
      target: `${SITE_URL}${detail.slug ? `/p/${detail.slug}` : `/projects/${detail.id}`}`,
    },
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/DonateAction',
      userInteractionCount: detail.backersCount,
    },
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
      {/* TABS — /p/[slug] stays the canonical STORY surface; its tab bar
          deep-links into the /projects/[id]/<tab> sub-routes (this page is
          the story tab itself, marked active via storyHref). */}
      <WathbaCampaignHeader id={detail.id} project={liveProject ?? undefined} />
      <WathbaCampaignTabBar
        id={detail.id}
        project={liveProject ?? undefined}
        storyHref={`/p/${slug}`}
      />
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '36px 26px 80px' }}>
        <WathbaLegacyTabRedirect id={detail.id} />
        <WathbaTabStory id={detail.id} project={liveProject ?? undefined} storyAr={detail.storyAr} />
        {/* STAKES/J3 — same-subcategory rail. */}
        <div style={{ marginTop: 48 }}>
          <WathbaProjectsRail title="مشاريع مشابهة" projects={similar} />
        </div>
      </div>
    </WathbaShell>
  );
}
