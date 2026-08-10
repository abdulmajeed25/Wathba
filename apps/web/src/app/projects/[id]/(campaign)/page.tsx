import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

import { adaptApiProjectDetail, adaptApiVenture, wathbaProjects } from '@/components/ventures/wathba/wathba-data';
import { WathbaLegacyTabRedirect, WathbaTabStory } from '@/components/ventures/wathba/wathba-tab-story';
import { WathbaProjectsRail } from '@/components/ventures/wathba/wathba-similar-rail';
import { getProjectDetail, getSimilarProjects, listVentures } from '@/lib/api/wathba';
import { notFound } from 'next/navigation';

/**
 * TABS — الحملة (story), the campaign's default tab. The persistent shell
 * (header + tab bar) lives in the (campaign) layout; this page renders only
 * the story column (TOC | story + risks | creator/rewards rail), the JSON-LD
 * and the similar rail. Old #anchor / ?tab= deep-links redirect to their
 * routes via WathbaLegacyTabRedirect.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const fixture = wathbaProjects.find((p) => p.id === id);
  // CC-22 — prefer the project's real title + creator-set SEO fields.
  const live = await getProjectDetail(id).catch(() => null);

  /*
   * NOTHING RESOLVED ⇒ 404, and it has to be decided HERE.
   *
   * The campaign layout already calls notFound() for an unknown id, and the
   * right page renders — «٤٠٤ الصفحة غير موجودة». The STATUS was still 200:
   * a notFound() thrown from a nested layout runs after the response has begun
   * streaming, and the status line is already on the wire. A crawler sees 200
   * plus a not-found page and indexes it, which is the definition of a soft-404.
   *
   * generateMetadata runs before the shell is committed, so throwing here
   * produces a real 404 — and it also stops the title fabricating a project:
   * /projects/this-does-not-exist was titled «مشروع this-does-not-exist · وثبة».
   */
  if (!live && !fixture) notFound();

  const title = live?.titleAr
    ? `${live.titleAr} · وثبة`
    : fixture
      ? `${fixture.titleAr} · وثبة`
      : `مشروع ${id} · وثبة`;
  const baseDescription = live?.metaDescription ?? live?.shortDescAr ?? fixture?.desc;
  // STAKES/S-10 F-04 — the share card carries the funded % for live campaigns.
  const pct =
    live && live.fundingGoalHalalas > 0 && (live.status === 'LIVE' || live.status === 'FUNDED')
      ? Math.round((live.raisedHalalas / live.fundingGoalHalalas) * 100)
      : null;
  const description = pct !== null ? `مُموَّل ${pct}٪ · ${baseDescription ?? ''}`.trim() : baseDescription;
  // STAKES/I2 + S-10 F-04 — og:image: campaign media, else the brand card.
  const ogImage = live?.ogImage ?? live?.mediaUrls?.[0] ?? '/og-default.png';
  // STAKES/N4 N6 — ONE canonical per project: the human slug when set.
  const canonical = live?.slug ? `/p/${live.slug}` : `/projects/${id}`;
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

// ISR — re-render every 60s so the story stays fresh without blowing the
// cache on every request.
export const revalidate = 60;

export default async function ProjectStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [live, detail] = await Promise.all([
    listVentures(),
    getProjectDetail(id).catch(() => null),
  ]);
  const apiRow = live?.find((v) => v.slug.toLowerCase() === id.toLowerCase());
  // POLISH — fall back to the API DETAIL, not to a demo fixture. adaptApiVenture
  // can only match a project that exists in the hardcoded demo table, so for
  // every real project it returned null and resolveCampaign silently rendered
  // wathbaProjects[0]. The detail payload is already fetched above; use it.
  const liveProject =
    (apiRow ? adaptApiVenture(apiRow) : null) ?? (detail ? adaptApiProjectDetail(detail) : null);
  // STAKES/J3 — same-subcategory rail (empty for fixture ids).
  const similar = detail ? await getSimilarProjects(detail.id).catch(() => []) : [];

  // STAKES/N5 — per-campaign structured data (CreativeWork + DonateAction).
  const jsonLd = detail
    ? {
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
        potentialAction: {
          '@type': 'DonateAction',
          target: `${SITE_URL}${detail.slug ? `/p/${detail.slug}` : `/projects/${detail.id}`}`,
        },
        interactionStatistic: {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/DonateAction',
          userInteractionCount: detail.backersCount,
        },
      }
    : null;

  return (
    <div>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <WathbaLegacyTabRedirect id={id} />
      <WathbaTabStory id={id} project={liveProject ?? undefined} storyAr={detail?.storyAr} />
      <div style={{ marginTop: 48 }}>
        <WathbaProjectsRail title="مشاريع مشابهة" projects={similar} />
      </div>
    </div>
  );
}
