import { Injectable } from '@nestjs/common';

import { cardVideoUrl } from '../common/card-media';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Batch HERO — the curated pool behind the rotating featured card.
 *
 * Four buckets, so the hero shows the platform's RANGE rather than four
 * variations on its biggest campaign:
 *
 *   strong   قوية             funded past goal, or staff-picked — the flagships
 *   diverse  متنوعة           the ordinary middle, deliberately across categories
 *   almost   قاربت الاكتمال    ≥75% and still open — urgency
 *   fresh    وصلت حديثاً       published in the last 14 days — the platform is alive
 *
 * Buckets are DERIVED from the data, never stored. A project that gains backers
 * moves from diverse to almost to strong on its own, and nothing has to be
 * re-tagged. That also means a bucket can legitimately come back empty (a brand
 * new deployment has no ≥75% campaign) — empty buckets are skipped, never
 * padded, because a hero slide with nothing behind it is worse than one fewer.
 */

/** Long enough to spare the DB on a busy homepage, short enough that a new
 *  campaign appears within a minute of publishing. */
const TTL_MS = 60_000;

export type HeroBucket = 'strong' | 'diverse' | 'almost' | 'fresh';

export interface HeroSlide {
  id: string;
  slug: string | null;
  titleAr: string;
  shortDescAr: string;
  imageUrl: string | null;
  /** The campaign video, when the creator uploaded one. Null for most
   *  projects — see the hover-video note in wathba-card-video.tsx. */
  videoUrl: string | null;
  creatorName: string;
  categoryAr: string | null;
  categorySlug: string | null;
  region: string | null;
  fundedPct: number;
  raisedHalalas: string;
  goalHalalas: string;
  backersCount: number;
  daysLeft: number;
  isStaffPick: boolean;
  bucket: HeroBucket;
}

const SELECT = {
  id: true,
  slug: true,
  titleAr: true,
  shortDescAr: true,
  mediaUrls: true,
  videoUrl: true,
  cardMedia: true,
  region: true,
  isStaffPick: true,
  fundingGoalHalalas: true,
  raisedHalalas: true,
  backersCount: true,
  deadline: true,
  publishedAt: true,
  createdBy: { select: { name: true } },
  categoryRef: { select: { slug: true, nameAr: true, parent: { select: { slug: true, nameAr: true } } } },
} as const;

@Injectable()
export class HeroService {
  constructor(private readonly prisma: PrismaService) {}

  private cache: { at: number; slides: HeroSlide[] } | null = null;

  async pool(): Promise<{ slides: HeroSlide[] }> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) {
      return { slides: this.cache.slides };
    }
    const slides = await this.build();
    this.cache = { at: Date.now(), slides };
    return { slides };
  }

  private async build(): Promise<HeroSlide[]> {
    // The presentability rule has to run in SQL, not after the fetch.
    //
    // Ordering by publishedAt and taking 120 puts the newest rows first, and the
    // newest rows on any box that has run the suite are the timestamped
    // golden-journey projects. Filtering them out AFTERWARDS left one slide — the
    // limit had already spent itself on rows about to be discarded. Prisma has no
    // regex operator, so the predicate is applied here and the ids feed the typed
    // query below.
    const presentable = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p."id"
      FROM "Project" p
      WHERE p."status" = 'LIVE'
        AND p."hiddenAt" IS NULL
        AND p."isTestFixture" = false
        AND p."publishedAt" IS NOT NULL
        AND array_length(p."mediaUrls", 1) > 0
        AND p."titleAr" !~ '[0-9]{10,}'
      ORDER BY p."publishedAt" DESC
      LIMIT 120`;
    if (presentable.length === 0) return [];

    const rows = await this.prisma.project.findMany({
      where: { id: { in: presentable.map((r) => r.id) } },
      select: SELECT,
      orderBy: { publishedAt: 'desc' },
    });

    const now = Date.now();
    const candidates = rows
      .map((p) => {
        const goal = p.fundingGoalHalalas;
        const pct = goal > 0n ? Number((p.raisedHalalas * 100n) / goal) : 0;
        const ageDays = p.publishedAt ? (now - p.publishedAt.getTime()) / 86_400_000 : 999;
        const top = p.categoryRef?.parent ?? p.categoryRef ?? null;
        const bucket: HeroBucket =
          p.isStaffPick || pct >= 100 ? 'strong' : pct >= 75 ? 'almost' : ageDays <= 14 ? 'fresh' : 'diverse';
        return {
          slide: {
            id: p.id,
            slug: p.slug,
            titleAr: p.titleAr,
            shortDescAr: p.shortDescAr,
            imageUrl: p.mediaUrls[0] ?? null,
            videoUrl: cardVideoUrl(p),
            creatorName: p.createdBy.name,
            categoryAr: top?.nameAr ?? null,
            categorySlug: top?.slug ?? null,
            region: p.region,
            fundedPct: pct,
            raisedHalalas: p.raisedHalalas.toString(),
            goalHalalas: goal.toString(),
            backersCount: p.backersCount,
            daysLeft: Math.max(0, Math.ceil((p.deadline.getTime() - now) / 86_400_000)),
            isStaffPick: p.isStaffPick,
            bucket,
          } satisfies HeroSlide,
          pct,
          ageDays,
        };
      });

    const byBucket: Record<HeroBucket, HeroSlide[]> = { strong: [], diverse: [], almost: [], fresh: [] };
    // Within a bucket, lead with what that bucket is ABOUT: strongest funding
    // for strong/almost, newest for fresh, and for diverse the ones furthest
    // from the others so the middle of the platform reads as varied.
    for (const c of candidates) byBucket[c.slide.bucket].push(c.slide);
    byBucket.strong.sort((a, b) => b.fundedPct - a.fundedPct);
    byBucket.almost.sort((a, b) => b.fundedPct - a.fundedPct);
    byBucket.fresh.sort((a, b) => b.backersCount - a.backersCount);
    byBucket.diverse = spreadByCategory(byBucket.diverse);

    return interleave(byBucket);
  }
}

/** Re-order so consecutive entries come from different categories. */
function spreadByCategory(list: HeroSlide[]): HeroSlide[] {
  const out: HeroSlide[] = [];
  const pool = [...list];
  let lastCat: string | null = null;
  while (pool.length) {
    const i = pool.findIndex((p) => p.categorySlug !== lastCat);
    const pick = pool.splice(i === -1 ? 0 : i, 1)[0]!;
    out.push(pick);
    lastCat = pick.categorySlug;
  }
  return out;
}

/**
 * strong → diverse → almost → fresh → … taking one from each in turn, and never
 * emitting two slides in a row that share a bucket OR a category.
 *
 * The rhythm is the point: a flagship, then something unlike it, then urgency,
 * then novelty. Cycling bucket-by-bucket gets that for free; the category check
 * is the part that needs care, because «قوية» and «قاربت» can both be technology
 * and would otherwise sit next to each other.
 */
function interleave(byBucket: Record<HeroBucket, HeroSlide[]>): HeroSlide[] {
  const order: HeroBucket[] = ['strong', 'diverse', 'almost', 'fresh'];
  const queues = order.map((b) => [...byBucket[b]]);
  const out: HeroSlide[] = [];
  let turn = 0;
  let guard = 0;

  while (queues.some((q) => q.length) && guard++ < 500) {
    // Try each bucket starting at this turn, so an exhausted bucket simply
    // yields to the next one instead of stalling the rotation.
    let taken = false;
    for (let step = 0; step < order.length && !taken; step++) {
      const q = queues[(turn + step) % order.length]!;
      if (!q.length) continue;
      const prev = out[out.length - 1];
      let i = q.findIndex((s) => !prev || s.categorySlug !== prev.categorySlug);
      // Every remaining entry shares the previous category — take the head
      // rather than drop it. A repeated category beats an omitted project.
      if (i === -1) i = 0;
      out.push(q.splice(i, 1)[0]!);
      turn = (turn + step + 1) % order.length;
      taken = true;
    }
    if (!taken) break;
  }
  // A hero that never stops rotating does not need the entire catalogue; ten
  // slides is ~100 seconds, longer than anyone watches.
  return out.slice(0, 10);
}
