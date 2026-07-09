import type { Metadata } from 'next';

import {
  adaptApiVenture,
  wathbaProjects,
} from '@/components/ventures/wathba/wathba-data';
import { WathbaCampaign } from '@/components/ventures/wathba/wathba-campaign';
import { WathbaProjectsRail } from '@/components/ventures/wathba/wathba-similar-rail';
import { WathbaShell } from '@/components/ventures/wathba/wathba-shell';
import { getProjectDetail, getSimilarProjects, listVentures } from '@/lib/api/wathba';

/**
 * Project / campaign page — full Kickstarter-style surface (rich header +
 * hero video + funding rail + trust band + 8 tabs incl. the 3-col campaign
 * tab with TOC). Public per M1 (middleware no longer gates this path);
 * action buttons inside the page bounce through /sign-in?next=<orig>.
 *
 * Server-rendered for SEO + first-paint speed. The live API lookup falls
 * back to the bundled fixture so anonymous browsing of the demo projects
 * (p1–p8) works even when the DB is empty.
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

// ISR — re-render every 60s so the funding totals stay fresh without
// blowing the cache on every request. Per-project page.
export const revalidate = 60;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [live, detail] = await Promise.all([
    listVentures(),
    // CC-14 — surfaces the PAUSED banner; S-8 — drives the similar rail.
    getProjectDetail(id).catch(() => null),
  ]);
  const apiRow = live?.find((v) => v.slug.toLowerCase() === id.toLowerCase());
  const liveProject = apiRow ? adaptApiVenture(apiRow) : null;
  const fallback = wathbaProjects.find((p) => p.id === id);
  const paused = detail?.status === 'PAUSED';
  const similar = detail ? await getSimilarProjects(detail.id).catch(() => []) : [];

  // STAKES/N5 — per-campaign structured data. schema.org has no crowdfunding
  // type; CreativeWork + creator + funding text is the defensible mapping.
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
      }
    : null;

  return (
    <WathbaShell>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
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
      <WathbaCampaign id={id} project={liveProject ?? fallback ?? undefined} />
      {/* STAKES/J3 — same-subcategory rail (empty for fixture ids). */}
      <WathbaProjectsRail title="مشاريع مشابهة" projects={similar} />
    </WathbaShell>
  );
}
