import Image from 'next/image';
import Link from 'next/link';

import type { ApiHomePayload, ApiHomeProjectCard, ApiEditorialCard } from '@/lib/api/wathba';
import { WathbaCardVideo, WathbaCardVideoGlyph } from './wathba-card-video';
import { WathbaCarousel } from './wathba-carousel';
import { WathbaHeroBanners } from './wathba-hero-banners';
import { Num } from './wathba-icons';
import { arabicCount, toArabicDigits } from './discover-all-constants';

/**
 * Batch HOME — the magazine body (S1..S12, Kickstarter home parity, Wathba-
 * adapted). Sections render in ADMIN-DEFINED order (HomepageSection) and only
 * when they have data — the page stays complete with half the sections off.
 * Server component: project data ISR'd upstream; only the carousels/banners
 * hydrate. One h1 lives in WathbaHome above — everything here is h2/h3.
 */

/**
 * HOME-REVIEW — the three visual merges.
 *
 * The audit found four consecutive editorial sections with the same container
 * and the same card and not one image between them (~1350px of identical
 * shapes), plus two pairs that a reader cannot tell apart: «قصص نجاح» followed
 * by «حوارات مع المبدعين», and «ركن المبدعين» followed by «نصائح التمويل
 * الجماعي». Two adjacent sections with one layout read as ONE section with a
 * stray heading in the middle, so the second title does no work at all.
 *
 * A merged block still has to honour the operator's toggles, and each half is
 * its own HomepageSection row. So a merge does not hard-code its parts: it
 * takes the ACTIVE key order (GET /v1/home returns only `isActive` rows) and
 * renders whichever halves are live, under whichever of its keys comes first.
 * Deactivating «حوارات» removes the interviews and leaves «قصص نجاح» titled and
 * alone; deactivating BOTH removes the block. That is the behaviour the ops
 * screen already promises, and merging must not quietly take it away.
 */
type MergePart = { key: string; subtitle: string; render: () => React.ReactNode };

function mergedBlock(
  self: string,
  title: string,
  order: string[],
  parts: MergePart[],
): React.ReactNode {
  const live = parts
    .filter((p) => order.includes(p.key))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  if (live.length === 0) return null;
  // One owner, so the block renders once and at the earlier of its positions.
  if (live[0]!.key !== self) return null;

  return (
    <Section k={self} title={title}>
      {live.map((p, i) => (
        <div key={p.key} data-section-part={p.key} style={{ marginTop: i === 0 ? 0 : 30 }}>
          {/* h3, not h2: the block owns the h2, and these are its parts. The
              heading outline was one of the a11y findings — a merged block that
              kept two h2s would read as two sections to a screen reader while
              looking like one on screen, which is the worst of both. */}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)', marginBottom: 12 }}>
            {p.subtitle}
          </h3>
          {p.render()}
        </div>
      ))}
    </Section>
  );
}

/**
 * HOME-REVIEW — the magazine's sections as a key → renderer map.
 *
 * These used to render as one contiguous block BELOW everything in
 * wathba-home. They are now merged into that file's ordered list, so a
 * magazine section can sit between two code-defined ones — which is the whole
 * point: the proof (a featured project, campaigns closing, success stories)
 * belongs above the creator call-to-action, not after it.
 *
 * Order and activation still come from HomepageSection via GET /v1/home; this
 * only stops the block from being positionally welded to the bottom.
 */
export function wathbaMagazineRenderers(
  payload: ApiHomePayload,
  /** Active section keys in their admin-defined order. See mergedBlock. */
  order: string[] = [],
): Record<string, () => React.ReactNode> {
  const stories: MergePart[] = [
    {
      key: 'success_stories',
      subtitle: 'قصص نجاح',
      render: () => <CardRow cards={payload.successStories} readMore />,
    },
    {
      key: 'creator_interviews',
      subtitle: 'حوارات مع المبدعين',
      render: () => <CardRow cards={payload.creatorInterviews} readMore />,
    },
  ].filter((p) =>
    p.key === 'success_stories'
      ? payload.successStories.length > 0
      : payload.creatorInterviews.length > 0,
  );

  const creatorResources: MergePart[] = [
    {
      key: 'creators_corner',
      subtitle: 'ركن المبدعين',
      render: () => (
        <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {payload.resources.map((c) => (
            <EditorialBanner key={c.id} c={c} compact />
          ))}
        </div>
      ),
    },
    {
      key: 'funding_tips',
      subtitle: 'نصائح التمويل الجماعي',
      render: () => <CardRow cards={payload.tips} />,
    },
  ].filter((p) => (p.key === 'creators_corner' ? payload.resources.length > 0 : payload.tips.length > 0));

  return {
    hero_banners: () =>
      payload.heroBanners.length > 0 ? <WathbaHeroBanners banners={payload.heroBanners} /> : null,
    // MERGE 3 — «مشروع مميز» becomes the page's one STAGE.
    //
    // This was the best material on the page and it was drawn exactly like the
    // twelve sections around it: same 1320 container, same white card, same
    // ground. The audit's fourth weakness was that monotony — no full-bleed
    // moment, no change of ground, no editorial opening anywhere.
    //
    // So this section, and only this one, goes edge to edge on a dark ground in
    // BOTH themes (see --stage in wathba-tokens.ts). Two full-bleed moments are
    // planned for the whole page — this and the creator call — because scarcity
    // is the entire mechanism: a third would make all three ordinary.
    //
    // The content is unchanged. «موصى بها لك» keeps its place beside the
    // feature rather than being dropped, because it is the same section key and
    // the same operator toggle — restructuring a section is not licence to
    // delete half of it.
    featured_recommended: () =>
      payload.featured || payload.trending.length > 0 ? (
        <section
          key="s2"
          data-section="featured_recommended"
          data-stage="1"
          style={{ background: 'var(--stage)', color: 'var(--stage-text)', padding: '56px 0' }}
        >
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 26px' }}>
            <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 24 }}>
              {payload.featured && (
                <div>
                  <SectionTitle>مشروع مميز</SectionTitle>
                  <StageFeature p={payload.featured} />
                </div>
              )}
              {payload.trending.length > 0 && (
                <div>
                  <SectionTitle>موصى بها لك</SectionTitle>
                  {/* minmax(0,1fr): the mini card's title is `white-space:
                      nowrap`, and nowrap text contributes its FULL width as
                      min-content — `overflow:hidden` does not reduce it. So a
                      plain 1fr track is sized by the longest project title,
                      not by the column. */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                    {payload.trending.slice(0, 4).map((p) => (
                      <StageMiniCard key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null,
    announcements: () =>
      payload.announcements.length > 0 ? (
        <Section key="s3" k="announcements" title="">
          <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {payload.announcements.map((c) => (
              <EditorialBanner key={c.id} c={c} />
            ))}
          </div>
        </Section>
      ) : null,
    collection_showcase: () =>
      payload.showcase ? (
        <Section key="s4" k="collection_showcase" title={`من حملات وثبة: ${payload.showcase.nameAr}`}>
          <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 24 }}>
            <BigProjectCard p={payload.showcase.featured} />
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>المزيد من الحملة</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {payload.showcase.grid.map((p) => (
                  <MiniProjectCard key={p.id} p={p} />
                ))}
              </div>
              <Link
                href={`/projects/discover-all?collection=${payload.showcase.slug}`}
                style={{ display: 'inline-block', marginTop: 8, padding: '6px 0', minHeight: 24, fontSize: 13, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none' }}
              >
                كل مشاريع الحملة ←
              </Link>
            </div>
          </div>
        </Section>
      ) : null,
    brand_program: () => (
      <Section key="s5" k="brand_program" title="">
        <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ ...bannerCard, background: 'linear-gradient(130deg, rgba(5,166,97,.14), rgba(3,169,142,.04)), var(--card)' }}>
            <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>الفكرة تبدأ بإيمان</h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 12 }}>
              وثبة منصة الدعم الجماعي السعودية بضمان التنفيذ: لا يُخصم ريال واحد قبل بلوغ الحملة
              عتبتها، وكل مبدع موثّق عبر نفاذ.
            </p>
            <Link href="/projects/about" style={bannerLink}>تعرّف على وثبة ←</Link>
          </div>
          {payload.programBanner ? (
            <EditorialBanner c={payload.programBanner} />
          ) : (
            <div style={bannerCard}>
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>صندوق دعم المشاريع الناشئة</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.7 }}>قريباً.</p>
            </div>
          )}
        </div>
      </Section>
    ),
    home_stretch: () =>
      payload.homeStretch.length > 0 ? (
        <Section key="s6" k="home_stretch" title="على وشك الاكتمال" more="/projects/discover-all?pct=p75_100">
          <WathbaCarousel label="مشاريع على وشك الاكتمال">
            {payload.homeStretch.map((p) => (
              <CarouselProjectCard key={p.id} p={p} large />
            ))}
          </WathbaCarousel>
        </Section>
      ) : null,
    // MERGE 1 — «من الفكرة إلى التسليم». Proof reads as one chapter: the
    // finished thing, then the person who finished it.
    success_stories: () => mergedBlock('success_stories', 'من الفكرة إلى التسليم', order, stories),
    creator_interviews: () =>
      mergedBlock('creator_interviews', 'من الفكرة إلى التسليم', order, stories),
    fresh_favorites: () =>
      payload.freshFavorites.length > 0 ? (
        <Section key="s9" k="fresh_favorites" title="مفضلات جديدة" more="/projects/discover-all?sort=newest">
          <WathbaCarousel label="مفضلات جديدة">
            {payload.freshFavorites.map((p) => (
              <CarouselProjectCard key={p.id} p={p} />
            ))}
          </WathbaCarousel>
        </Section>
      ) : null,
    // MERGE 2 — «مصادر المبدعين». Same audience, same shape, one block: the
    // reader who just said yes to «ابدأ مشروعك» needs the next step, not two
    // separately-titled shelves of it.
    creators_corner: () =>
      mergedBlock('creators_corner', 'مصادر المبدعين', order, creatorResources),
    funding_tips: () => mergedBlock('funding_tips', 'مصادر المبدعين', order, creatorResources),
    trust_duo: () =>
      payload.trustGuides.length > 0 ? (
        <Section key="s12" k="trust_duo" title="">
          <div className="wathba-mag-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {payload.trustGuides.map((c) => (
              <EditorialBanner key={c.id} c={c} />
            ))}
          </div>
        </Section>
      ) : null,
  };
}

/* ── building blocks ─────────────────────────────────────────────── */

function Section({ k, title, more, children }: { k: string; title: string; more?: string; children: React.ReactNode }) {
  return (
    <section
      data-section={k}
      style={{
        maxWidth: 1320, margin: '0 auto', padding: '0 26px',
        // POLISH — `content-visibility: auto` used to live here with
        // `contain-intrinsic-size: auto 420px`, to skip layout/paint for the
        // magazine sections until they neared the viewport.
        //
        // It was responsible for essentially ALL of the homepage's CLS. These
        // sections are 150–335px tall in reality, so every one of them
        // COLLAPSED from the 420px placeholder the moment it was scrolled into
        // view, dragging everything below it upwards. Measured: 0.0034 without
        // scrolling, 0.64 with — a single shift of 0.6414, and the page sat in
        // the "poor" band (>0.25) for as long as the directive was here.
        //
        // Tuning the placeholder cannot fix it: no single value fits a 150–335px
        // range, and per-section values would drift the first time copy or the
        // viewport changed. The render-skipping was worth less than the layout
        // stability it was spending, so it is gone. LCP was re-measured after
        // removal to confirm the cost did not simply move.
      }}
    >
      {title && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h2>
          {more && (
            <Link href={more} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none', padding: '6px 0', display: 'inline-block' }}>
              اكتشف المزيد ←
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>{children}</h2>;
}

function href(p: ApiHomeProjectCard): string {
  return p.slug ? `/p/${p.slug}` : `/projects/${p.id}`;
}

/**
 * Stage 1 item 11 — the cover box.
 *
 * `ratio` replaces the old fixed pixel `height` on the project cards. Both are
 * deterministic before the image loads, so the CLS guarantee is unchanged; a
 * ratio is used because these cards are now sized per section and a fixed
 * height would letterbox in the large one and crop in the small one.
 *
 * `height` is kept for the callers that are genuinely a fixed strip.
 */
function ProjectArt({
  p,
  height,
  ratio,
  video,
}: {
  p: ApiHomeProjectCard;
  height?: number;
  ratio?: string;
  video?: boolean;
}) {
  const box: React.CSSProperties = ratio
    ? { aspectRatio: ratio, position: 'relative', borderRadius: 12, overflow: 'hidden' }
    : { position: 'relative', height, borderRadius: 12, overflow: 'hidden' };
  const cover = p.imageUrl ? (
    <Image src={p.imageUrl} alt="" fill style={{ objectFit: 'cover' }} sizes="(max-width: 760px) 90vw, 400px" />
  ) : null;
  return (
    <div className={p.imageUrl ? undefined : 'wathba-ph'} style={box}>
      {video ? (
        <WathbaCardVideo videoUrl={p.videoUrl} poster={p.imageUrl}>
          {cover}
        </WathbaCardVideo>
      ) : (
        cover
      )}
      {video && p.videoUrl ? <WathbaCardVideoGlyph /> : null}
    </div>
  );
}

function Funded({ p }: { p: ApiHomeProjectCard }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 5, borderRadius: 30, background: 'rgba(var(--ink-rgb),.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(p.fundedPct, 100)}%`, background: 'var(--grad-bar)', borderRadius: 30 }} />
      </div>
      <Num style={{ fontSize: 11.5, color: 'var(--accent-ink)', fontWeight: 700, display: 'inline-block', marginTop: 4 }}>
        %{toArabicDigits(p.fundedPct)} مُموَّل
      </Num>
    </div>
  );
}

function BigProjectCard({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link href={href(p)} className="lift" style={{ ...cardBase, display: 'block' }}>
      <ProjectArt p={p} height={230} />
      <h3 style={{ fontSize: 17, fontWeight: 700, margin: '12px 0 6px' }}>{p.titleAr}</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{p.shortDescAr}</p>
      <Funded p={p} />
    </Link>
  );
}

/* ── the stage ───────────────────────────────────────────────────────
 *
 * Separate components rather than a `dark` prop on the existing cards, because
 * almost nothing carries over: cardBase paints `var(--card)` (white in light
 * mode) and Funded draws its track in `rgba(var(--ink-rgb),.08)` — ink is DARK
 * in the light theme, so that track would be near-invisible against the stage.
 * A prop threading through both would have been a bigger, more fragile change
 * than two small components that state their own colours.
 */
const stageCard: React.CSSProperties = {
  background: 'var(--stage-1)',
  border: '1px solid rgba(244,247,245,.10)',
  borderRadius: 16,
  padding: 16,
  textDecoration: 'none',
  color: 'var(--stage-text)',
};

function StageFunded({ p }: { p: ApiHomeProjectCard }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: 6, borderRadius: 30, background: 'rgba(244,247,245,.14)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(p.fundedPct, 100)}%`,
            background: 'var(--grad-bar)',
            borderRadius: 30,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12.5 }}>
        <Num style={{ fontWeight: 700, color: 'var(--on-scrim-accent)' }}>%{toArabicDigits(p.fundedPct)}</Num>
        <Num style={{ color: 'var(--stage-muted)' }}>{arabicCount(p.backersCount)} داعم</Num>
      </div>
    </div>
  );
}

function StageFeature({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link href={href(p)} className="lift" style={{ ...stageCard, display: 'block', padding: 18 }}>
      {/* Taller than the 230px this used to get. The stage exists to give one
          story room; a feature image the same size as everything else would
          make the change of ground decorative rather than structural. */}
      <ProjectArt p={p} height={300} />
      <h3 style={{ fontSize: 21, fontWeight: 700, margin: '16px 0 8px', lineHeight: 1.4 }}>{p.titleAr}</h3>
      <p style={{ fontSize: 14, color: 'var(--stage-muted)', lineHeight: 1.7 }}>{p.shortDescAr}</p>
      <StageFunded p={p} />
      {/* The review's CTA plan: one primary call per chapter, and this is the
          conversion point at peak conviction. It is a <span> because the whole
          card is already the link — nesting an <a> inside an <a> is invalid and
          screen readers announce the nested one unpredictably. */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 40,
          marginTop: 16,
          padding: '0 20px',
          borderRadius: 12,
          background: 'var(--grad)',
          color: 'var(--on-accent)',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        ادعم هذا المشروع
      </span>
    </Link>
  );
}

function StageMiniCard({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link href={href(p)} className="lift" style={{ ...stageCard, display: 'block', padding: 12 }}>
      <ProjectArt p={p} height={90} />
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginTop: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {p.titleAr}
      </h3>
      <StageFunded p={p} />
    </Link>
  );
}

function MiniProjectCard({ p }: { p: ApiHomeProjectCard }) {
  return (
    <Link href={href(p)} className="lift" style={{ ...cardBase, display: 'block', padding: 12 }}>
      <ProjectArt p={p} height={90} />
      <h3 style={{ fontSize: 13, fontWeight: 700, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.titleAr}
      </h3>
      <Funded p={p} />
    </Link>
  );
}

/**
 * Stage 1 item 11 — layout variance, which is also the rhythm fix the report
 * asked for. Two sizes, and the size states what the shelf is for:
 *
 *  - `large`  «على وشك الاكتمال» — a discovery shelf you are meant to stop at.
 *             A 340px card with a 3/2 cover, matching «الرائجة».
 *  - default  «مفضلات جديدة» — a browse strip you are meant to scan. Kept
 *             narrow, and its cover kept at 16/9 rather than 3/2, so the two
 *             carousels do not read as the same shelf twice.
 *
 * Titles were `nowrap` + ellipsis at 14px, which truncated most real Arabic
 * project titles mid-word. The large card gives them two lines at 16.5px; the
 * browse strip keeps one line because that is the point of a strip.
 */
function CarouselProjectCard({ p, large }: { p: ApiHomeProjectCard; large?: boolean }) {
  return (
    <Link
      href={href(p)}
      className="lift"
      style={{
        ...cardBase,
        display: 'block',
        flex: large ? '0 0 340px' : '0 0 244px',
        scrollSnapAlign: 'start',
      }}
    >
      <ProjectArt p={p} ratio={large ? '3 / 2' : '16 / 9'} video />
      <h3
        style={
          large
            ? {
                fontSize: 16.5,
                fontWeight: 700,
                marginTop: 12,
                lineHeight: 1.45,
                minHeight: '2.9em',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : { fontSize: 14, fontWeight: 700, marginTop: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
        }
      >
        {p.titleAr}
      </h3>
      <Funded p={p} />
    </Link>
  );
}

function cardLink(c: ApiEditorialCard): string | null {
  if (c.slug && c.bodyLongAr) return `/stories/${c.slug}`;
  return c.linkUrl ?? null;
}

function EditorialBanner({ c, compact }: { c: ApiEditorialCard; compact?: boolean }) {
  const link = cardLink(c);
  const inner = (
    <div style={{ ...bannerCard, minHeight: compact ? 120 : 150 }}>
      <h3 style={{ fontSize: compact ? 16 : 19, fontWeight: 700, marginBottom: 8 }}>{c.titleAr}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: link ? 12 : 0 }}>{c.bodyAr}</p>
      {link && <span style={bannerLink}>{c.linkLabelAr ?? 'اقرأ المزيد'} ←</span>}
    </div>
  );
  return link ? (
    <Link href={link} className="lift" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

function CardRow({ cards, readMore }: { cards: ApiEditorialCard[]; readMore?: boolean }) {
  return (
    <div className="wathba-mag-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {cards.map((c) => {
        const link = cardLink(c);
        const body = (
          <article style={{ ...cardBase, height: '100%' }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 8, lineHeight: 1.5 }}>{c.titleAr}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>{c.bodyAr}</p>
            {readMore && link && (
              <span style={{ ...bannerLink, fontSize: 12.5, display: 'inline-block', marginTop: 10 }}>اقرأ المزيد ←</span>
            )}
          </article>
        );
        return link ? (
          <Link key={c.id} href={link} className="lift" style={{ textDecoration: 'none', color: 'inherit' }}>
            {body}
          </Link>
        ) : (
          <div key={c.id}>{body}</div>
        );
      })}
    </div>
  );
}

const cardBase: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid rgba(var(--ink-rgb),.08)',
  borderRadius: 16, padding: 16, textDecoration: 'none', color: 'inherit',
};
const bannerCard: React.CSSProperties = {
  ...cardBase, padding: '22px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
};
/**
 * The banner links sat in a 20px line box — below the 24px minimum in WCAG 2.5.8
 * (AA). inline-flex + minHeight grows the target without moving the text: the
 * extra height is centred, so the banner's layout is unchanged and only the
 * hittable area grows. Measured before at 20px, after at 24px.
 */
const bannerLink: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 700, color: 'var(--accent-ink)', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', minHeight: 24,
};
