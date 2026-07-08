import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  UpdateProjectDto,
  UpdateStoryDto,
} from './dto/project.dto';
import { MilestoneStatus, Prisma, ProjectStatus, type Project, type ProjectCategory } from '@prisma/client';

/**
 * Projects bounded context. Owns the project lifecycle.
 * DRAFT → UNDER_REVIEW → LIVE → … (admin reviews; here, owner submits).
 * Money in BigInt halalas; serialized via toPublic().
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Batch CAT — legacy ProjectCategory enum → the matching top-level Category
   * node id, so every new/edited project also carries the canonical
   * `categoryId`. MUSIC was removed from the tree; its projects resolve to
   * Film & Video → Music Videos (amendment). Returns null if the tree is not
   * seeded (fresh DB) so writes never hard-fail on taxonomy.
   */
  private static readonly LEGACY_SLUG: Record<string, string> = {
    TECH: 'technology', DESIGN: 'design', FILM: 'film-video', MUSIC: 'film-video',
    FOOD: 'food', GAMES: 'games', PUBLISHING: 'publishing', FASHION: 'fashion',
    ART: 'art', SOCIAL: 'social-impact',
  };
  // Reverse — top-level slug → legacy enum (null for the new Saudi categories).
  private static readonly REVERSE_LEGACY: Record<string, ProjectCategory> = {
    technology: 'TECH', design: 'DESIGN', 'film-video': 'FILM', food: 'FOOD',
    games: 'GAMES', publishing: 'PUBLISHING', fashion: 'FASHION', art: 'ART',
    'social-impact': 'SOCIAL',
  };

  private async categoryIdForLegacy(cat: string | null | undefined): Promise<string | null> {
    if (!cat) return null;
    const slug = ProjectsService.LEGACY_SLUG[cat];
    if (!slug) return null;
    const top = await this.prisma.category.findFirst({
      where: { slug, parentId: null },
      select: { id: true },
    });
    if (!top) return null;
    if (cat === 'MUSIC') {
      const mv = await this.prisma.category.findFirst({
        where: { slug: 'music-videos', parentId: top.id },
        select: { id: true },
      });
      return mv?.id ?? top.id;
    }
    return top.id;
  }

  /**
   * Batch CAT — resolve the canonical categoryId + legacy enum from whichever
   * the caller supplied. `categoryId` (two-level wizard) wins and derives the
   * legacy enum from its top-level (null for the new Saudi categories); a bare
   * legacy enum still resolves a categoryId. `required` guards create.
   */
  private async resolveCategory(
    categoryId: string | undefined,
    legacy: ProjectCategory | undefined,
    required: boolean,
  ): Promise<{ categoryId: string | null; category: ProjectCategory | null }> {
    if (categoryId) {
      const node = await this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true, slug: true, parentId: true, parent: { select: { slug: true } } },
      });
      if (!node) throw new BadRequestException('الفئة غير موجودة');
      const topSlug = node.parentId ? node.parent!.slug : node.slug;
      return { categoryId: node.id, category: ProjectsService.REVERSE_LEGACY[topSlug] ?? null };
    }
    if (legacy) {
      return { categoryId: await this.categoryIdForLegacy(legacy), category: legacy };
    }
    if (required) throw new BadRequestException('اختر فئة للمشروع');
    return { categoryId: null, category: null };
  }

  async create(creatorId: string, dto: CreateProjectDto): Promise<Project> {
    // Provisional deadline; admin sets the real one on publish.
    const deadline = new Date(Date.now() + dto.durationDays * 86_400_000);
    const cat = await this.resolveCategory(dto.categoryId, dto.category, true);
    return this.prisma.project.create({
      data: {
        titleAr: dto.titleAr,
        shortDescAr: dto.shortDescAr,
        category: cat.category,
        categoryId: cat.categoryId,
        storyAr: dto.storyAr,
        mediaUrls: dto.mediaUrls ?? [],
        fundingGoalHalalas: BigInt(dto.fundingGoalHalalas),
        releaseThresholdPct: dto.releaseThresholdPct ?? 80,
        durationDays: dto.durationDays,
        deadline,
        productSpecAr: dto.productSpecAr,
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
        createdById: creatorId,
        status: ProjectStatus.DRAFT,
        platformPartner: dto.platformPartner
          ? (dto.platformPartner as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async update(creatorId: string, projectId: string, dto: UpdateProjectDto): Promise<Project> {
    const proj = await this.requireOwned(creatorId, projectId);
    if (proj.status !== ProjectStatus.DRAFT && proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`cannot edit project in status ${proj.status}`);
    }
    // Batch CAT — keep categoryId + legacy enum in lock-step on edit (either
    // input drives both).
    const catTouched = dto.categoryId !== undefined || dto.category !== undefined;
    const cat = catTouched
      ? await this.resolveCategory(dto.categoryId, dto.category, false)
      : null;
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.titleAr !== undefined && { titleAr: dto.titleAr }),
        ...(dto.shortDescAr !== undefined && { shortDescAr: dto.shortDescAr }),
        ...(cat && { category: cat.category, categoryId: cat.categoryId }),
        ...(dto.storyAr !== undefined && { storyAr: dto.storyAr }),
        ...(dto.mediaUrls !== undefined && { mediaUrls: dto.mediaUrls }),
        ...(dto.fundingGoalHalalas !== undefined && {
          fundingGoalHalalas: BigInt(dto.fundingGoalHalalas),
        }),
        ...(dto.releaseThresholdPct !== undefined && {
          releaseThresholdPct: dto.releaseThresholdPct,
        }),
        ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
        ...(dto.productSpecAr !== undefined && { productSpecAr: dto.productSpecAr }),
        ...(dto.expectedDeliveryDate !== undefined && {
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : null,
        }),
        ...(dto.platformPartner !== undefined && {
          platformPartner:
            dto.platformPartner === null
              ? Prisma.JsonNull
              : (dto.platformPartner as unknown as Prisma.InputJsonValue),
        }),
        // CC-22 SEO + CC-20 scheduled launch.
        ...(dto.slug !== undefined && { slug: dto.slug || null }),
        ...(dto.ogImage !== undefined && { ogImage: dto.ogImage || null }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription || null }),
        ...(dto.scheduledLaunchAt !== undefined && {
          scheduledLaunchAt: dto.scheduledLaunchAt ? new Date(dto.scheduledLaunchAt) : null,
        }),
      },
    }).catch((e: unknown) => {
      // Unique slug clash → friendly 400 instead of a 500.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('هذا المُعرّف (slug) مستخدَم بالفعل — اختر غيره');
      }
      throw e;
    });
  }

  /**
   * CC-21 — duplicate a project into a fresh DRAFT owned by the same creator,
   * copying content + reward tiers (not pledges/updates/money). Lets a creator
   * relaunch a finished campaign or fork a template.
   */
  async duplicate(creatorId: string, projectId: string): Promise<Project> {
    const src = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { rewardTiers: true },
    });
    if (!src) throw new NotFoundException('project not found');
    if (src.createdById !== creatorId) throw new ForbiddenException('not your project');

    const deadline = new Date(Date.now() + src.durationDays * 86_400_000);
    return this.prisma.project.create({
      data: {
        titleAr: `${src.titleAr} (نسخة)`,
        shortDescAr: src.shortDescAr,
        category: src.category,
        categoryId: src.categoryId,
        storyAr: src.storyAr,
        mediaUrls: src.mediaUrls,
        fundingGoalHalalas: src.fundingGoalHalalas,
        releaseThresholdPct: src.releaseThresholdPct,
        durationDays: src.durationDays,
        deadline,
        productSpecAr: src.productSpecAr,
        expectedDeliveryDate: src.expectedDeliveryDate,
        createdById: creatorId,
        status: ProjectStatus.DRAFT,
        // slug is unique → never copied.
        rewardTiers: {
          create: src.rewardTiers.map((t) => ({
            titleAr: t.titleAr,
            amountHalalas: t.amountHalalas,
            descAr: t.descAr,
            includesPhysicalProduct: t.includesPhysicalProduct,
            requiresShipping: t.requiresShipping,
            estDeliveryDate: t.estDeliveryDate,
            limitQty: t.limitQty,
            popular: t.popular,
            featured: t.featured,
            includedItems: t.includedItems as unknown as Prisma.InputJsonValue,
            shipsTo: t.shipsTo,
            sortOrder: t.sortOrder,
          })),
        },
      },
    });
  }

  /**
   * CC-20 — flip SCHEDULED projects whose launch time has arrived to LIVE
   * (stamping publishedAt + a fresh deadline). Called by the launch scheduler.
   */
  async launchDueScheduled(): Promise<{ launched: number }> {
    const due = await this.prisma.project.findMany({
      where: { status: ProjectStatus.SCHEDULED, scheduledLaunchAt: { lte: new Date() } },
      select: { id: true, durationDays: true },
    });
    let launched = 0;
    for (const p of due) {
      const now = new Date();
      const deadline = new Date(now.getTime() + p.durationDays * 86_400_000);
      const claimed = await this.prisma.project.updateMany({
        where: { id: p.id, status: ProjectStatus.SCHEDULED },
        data: { status: ProjectStatus.LIVE, publishedAt: now, deadline, scheduledLaunchAt: null },
      });
      if (claimed.count > 0) launched++;
    }
    return { launched };
  }

  /**
   * CC-11 — edit the story/media. Unlike the general update() (locked to
   * DRAFT/UNDER_REVIEW), story edits are allowed while LIVE/PAUSED per policy §2,
   * but every post-launch edit writes a PUBLIC change-log entry so backers can
   * see the campaign changed after they pledged. Blocked once settled.
   */
  async updateStory(creatorId: string, projectId: string, dto: UpdateStoryDto): Promise<Project> {
    const proj = await this.requireOwned(creatorId, projectId);
    const editable: ProjectStatus[] = [
      ProjectStatus.DRAFT,
      ProjectStatus.UNDER_REVIEW,
      ProjectStatus.LIVE,
      ProjectStatus.PAUSED,
    ];
    if (!editable.includes(proj.status)) {
      throw new BadRequestException(`cannot edit the story in status ${proj.status}`);
    }
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        storyAr: dto.storyAr,
        ...(dto.mediaUrls !== undefined && { mediaUrls: dto.mediaUrls }),
      },
    });

    const postLaunch = proj.status === ProjectStatus.LIVE || proj.status === ProjectStatus.PAUSED;
    if (postLaunch) {
      const note = dto.changeNote?.trim();
      await this.prisma.projectChangeLog.create({
        data: {
          projectId,
          actorId: creatorId,
          field: 'story',
          summaryAr: note
            ? `حدّث صاحب المشروع نص القصة: ${note}`
            : 'حدّث صاحب المشروع نص القصة',
        },
      });
      await this.audit.log({
        actorId: creatorId,
        action: 'creator.project.story-edit',
        entity: 'Project',
        entityId: projectId,
        detail: { projectId, changeNote: note ?? null },
      });
    }
    return updated;
  }

  async submitForReview(creatorId: string, projectId: string): Promise<Project> {
    const proj = await this.requireOwned(creatorId, projectId);
    // Sprint 2 / P0-501: creators must be Nafath-verified before anything
    // they authored can go to review (KSA identity posture — money will
    // eventually flow to this person).
    const creator = await this.prisma.user.findUnique({ where: { id: creatorId } });
    if (!creator?.nafathVerified) {
      throw new ForbiddenException(
        'KYC required — verify your identity via Nafath before submitting a project',
      );
    }
    if (proj.status !== ProjectStatus.DRAFT) {
      throw new BadRequestException(`only DRAFT projects can be submitted (was ${proj.status})`);
    }
    if (proj.storyAr.length < 200) {
      throw new BadRequestException('story must be at least 200 chars to submit for review');
    }
    if (proj.fundingGoalHalalas <= 0n) {
      throw new BadRequestException('fundingGoal must be positive');
    }
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      // Clear stale rejection feedback on resubmit (CC-04) so the creator
      // doesn't see the previous round's note while UNDER_REVIEW.
      data: { status: ProjectStatus.UNDER_REVIEW, reviewFeedback: null },
    });
    // CC-06 — audit the creator's submit-for-review decision.
    await this.audit.log({
      actorId: creatorId,
      action: 'creator.project.submit',
      entity: 'Project',
      entityId: projectId,
      detail: { projectId, titleAr: updated.titleAr },
    });
    return updated;
  }

  /**
   * Creator: closes out the campaign once every milestone is RELEASED.
   * IN_PRODUCTION → DELIVERED is the FSM's terminal success state.
   */
  async completeDelivery(creatorId: string, projectId: string): Promise<Project> {
    const proj = await this.requireOwned(creatorId, projectId);
    if (proj.status !== ProjectStatus.IN_PRODUCTION) {
      throw new BadRequestException(
        `only IN_PRODUCTION projects can be marked delivered (was ${proj.status})`,
      );
    }
    const unreleased = await this.prisma.milestone.count({
      where: { projectId, status: { not: MilestoneStatus.RELEASED } },
    });
    if (unreleased > 0) {
      throw new BadRequestException(
        `${unreleased} milestone(s) not yet RELEASED — deliver after the full escrow plan completes`,
      );
    }
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.DELIVERED },
    });
    // CC-09 — audit the creator's delivery close-out.
    await this.audit.log({
      actorId: creatorId,
      action: 'creator.project.deliver',
      entity: 'Project',
      entityId: projectId,
      detail: { projectId, titleAr: updated.titleAr },
    });
    return updated;
  }

  /** Admin: approves a project and starts the funding clock. */
  async publish(projectId: string): Promise<Project> {
    const proj = await this.findById(projectId);
    if (proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`only UNDER_REVIEW projects can publish (was ${proj.status})`);
    }
    const now = new Date();
    const deadline = new Date(now.getTime() + proj.durationDays * 86_400_000);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.LIVE, publishedAt: now, deadline },
    });
  }

  async findById(id: string): Promise<Project> {
    const proj = await this.prisma.project.findUnique({
      where: { id },
      include: { rewardTiers: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!proj) throw new NotFoundException('project not found');
    return proj;
  }

  /** STAKES/N6 — detail lookup by UUID or human-readable slug (/p/[slug]). */
  async findByIdOrSlug(idOrSlug: string): Promise<Project> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) return this.findById(idOrSlug);
    const proj = await this.prisma.project.findUnique({
      where: { slug: idOrSlug.toLowerCase() },
      include: { rewardTiers: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!proj) throw new NotFoundException('project not found');
    return proj;
  }

  // Batch CAT — discovery-filter windows.
  private static readonly TREND_WINDOW_MS = 72 * 3_600_000; // pledge velocity look-back
  private static readonly NEARLY_MIN_PCT = 75; // "قاربت على التمويل" threshold
  private static readonly NEARLY_DEADLINE_MS = 48 * 3_600_000; // still ≥ this much time left
  private static readonly JUST_LAUNCHED_MS = 7 * 86_400_000; // went live within this window

  /**
   * Batch CAT — resolve a catSlug (+ optional subSlug) to the set of categoryIds
   * to match. A top-level includes all its subcategories (OR); a subSlug narrows
   * to that single node. Unknown slug → empty set (no results, never a crash).
   */
  private async resolveCategoryIds(
    categorySlug?: string,
    subSlug?: string,
  ): Promise<string[] | null> {
    if (!categorySlug) return null;
    const top = await this.prisma.category.findFirst({
      where: { slug: categorySlug, parentId: null },
      select: { id: true },
    });
    if (!top) return [];
    if (subSlug) {
      const sub = await this.prisma.category.findFirst({
        where: { slug: subSlug, parentId: top.id },
        select: { id: true },
      });
      return sub ? [sub.id] : [];
    }
    const kids = await this.prisma.category.findMany({
      where: { parentId: top.id },
      select: { id: true },
    });
    return [top.id, ...kids.map((k) => k.id)];
  }

  async list(q: ListProjectsQueryDto): Promise<{ items: Project[]; nextCursor: string | null }> {
    const take = q.take ?? 20;
    const where: Prisma.ProjectWhereInput = {};

    // Canonical taxonomy filter (categorySlug/subSlug) takes precedence over the
    // legacy enum, which stays for back-compat.
    const catIds = await this.resolveCategoryIds(q.categorySlug, q.subSlug);
    if (catIds) where.categoryId = { in: catIds };
    else if (q.category) where.category = q.category;

    if (q.includePartnered === false) where.platformPartner = { equals: Prisma.JsonNull };

    // A discovery filter forces the LIVE-and-fundable universe; otherwise honour
    // the explicit status param (default = discoverable set).
    if (q.filter) {
      where.status = ProjectStatus.LIVE;
    } else if (q.status === 'live') where.status = ProjectStatus.LIVE;
    else if (q.status === 'successful') where.status = ProjectStatus.SUCCESSFUL;
    else if (q.status === 'funded') where.status = ProjectStatus.FUNDED;
    else
      where.status = {
        in: [ProjectStatus.LIVE, ProjectStatus.SUCCESSFUL, ProjectStatus.FUNDED],
      };

    // Computed filters (need cross-row aggregation) go through their own path.
    if (q.filter === 'trending' || q.filter === 'nearly_funded') {
      return this.listComputed(q.filter, where, take, q.cursor);
    }

    // Native-WHERE filters compose cleanly with keyset pagination.
    const now = Date.now();
    if (q.filter === 'just_launched') {
      where.publishedAt = { gte: new Date(now - ProjectsService.JUST_LAUNCHED_MS) };
    } else if (q.filter === 'near_you') {
      // "matches user's region" — the region is supplied explicitly (profile /
      // picker). Without one the filter can't resolve → empty result.
      if (!q.region) return { items: [], nextCursor: null };
      where.region = q.region;
    } else if (q.filter === 'staff_pick') {
      where.isStaffPick = true;
    }

    const orderBy: Prisma.ProjectOrderByWithRelationInput[] =
      q.filter === 'just_launched'
        ? [{ publishedAt: 'desc' }, { id: 'desc' }]
        : q.sort === 'new'
          ? [{ publishedAt: 'desc' }, { createdAt: 'desc' }]
          : q.sort === 'ending_soon'
            ? [{ deadline: 'asc' }]
            : q.sort === 'most_funded'
              ? [{ raisedHalalas: 'desc' }]
              : [{ backersCount: 'desc' }, { raisedHalalas: 'desc' }];

    const items = await this.prisma.project.findMany({
      where,
      orderBy,
      take: take + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    });
    const nextCursor = items.length > take ? items[take]!.id : null;
    return { items: items.slice(0, take), nextCursor };
  }

  /**
   * Batch CAT — filters that rank/narrow by cross-row aggregation:
   *  - trending: LIVE projects ordered by 72h pledge velocity (zero-velocity
   *    projects sort last so the page is never empty), then backers/raised.
   *  - nearly_funded: LIVE, ≥75% funded, ≥48h left; ordered by funded% desc.
   * Ordering is computed in memory and paged by opaque id cursor. DISC replaces
   * this with an indexed keyset + the <300ms EXPLAIN gate.
   */
  private async listComputed(
    filter: 'trending' | 'nearly_funded',
    baseWhere: Prisma.ProjectWhereInput,
    take: number,
    cursor?: string,
  ): Promise<{ items: Project[]; nextCursor: string | null }> {
    const now = Date.now();
    const where: Prisma.ProjectWhereInput = { ...baseWhere };
    if (filter === 'nearly_funded') {
      where.deadline = { gte: new Date(now + ProjectsService.NEARLY_DEADLINE_MS) };
    }

    const rows = await this.prisma.project.findMany({
      where,
      select: { id: true, fundingGoalHalalas: true, raisedHalalas: true, backersCount: true },
    });

    let orderedIds: string[];
    if (filter === 'nearly_funded') {
      orderedIds = rows
        .map((r) => ({
          id: r.id,
          pct: Number(r.fundingGoalHalalas) > 0
            ? (Number(r.raisedHalalas) * 100) / Number(r.fundingGoalHalalas)
            : 0,
        }))
        .filter((r) => r.pct >= ProjectsService.NEARLY_MIN_PCT)
        .sort((a, b) => b.pct - a.pct)
        .map((r) => r.id);
    } else {
      const since = new Date(now - ProjectsService.TREND_WINDOW_MS);
      const vel = rows.length
        ? await this.prisma.pledge.groupBy({
            by: ['projectId'],
            where: {
              projectId: { in: rows.map((r) => r.id) },
              createdAt: { gte: since },
              status: { in: ['HELD', 'CAPTURED'] },
            },
            _count: { _all: true },
          })
        : [];
      const velMap = new Map(vel.map((v) => [v.projectId, v._count._all]));
      orderedIds = rows
        .map((r) => ({ id: r.id, v: velMap.get(r.id) ?? 0, b: r.backersCount }))
        .sort((a, b) => b.v - a.v || b.b - a.b)
        .map((r) => r.id);
    }

    const start = cursor ? orderedIds.indexOf(cursor) + 1 : 0;
    const pageIds = orderedIds.slice(start, start + take);
    const nextCursor =
      start + take < orderedIds.length && pageIds.length > 0
        ? pageIds[pageIds.length - 1]!
        : null;

    if (pageIds.length === 0) return { items: [], nextCursor: null };
    const items = await this.prisma.project.findMany({ where: { id: { in: pageIds } } });
    const byId = new Map(items.map((i) => [i.id, i]));
    const ordered = pageIds.map((id) => byId.get(id)).filter((p): p is Project => Boolean(p));
    return { items: ordered, nextCursor };
  }

  toPublic(
    p: Project & { rewardTiers?: Array<Record<string, unknown>> },
  ): Record<string, unknown> {
    return {
      id: p.id,
      titleAr: p.titleAr,
      shortDescAr: p.shortDescAr,
      category: p.category,
      // Batch CAT — canonical taxonomy + region + editorial pick.
      categoryId: p.categoryId ?? null,
      region: p.region ?? null,
      isStaffPick: p.isStaffPick,
      storyAr: p.storyAr,
      mediaUrls: p.mediaUrls,
      fundingGoalHalalas: Number(p.fundingGoalHalalas),
      releaseThresholdPct: p.releaseThresholdPct,
      durationDays: p.durationDays,
      deadline: p.deadline.toISOString(),
      status: p.status,
      productSpecAr: p.productSpecAr,
      expectedDeliveryDate: p.expectedDeliveryDate?.toISOString() ?? null,
      createdBy: p.createdById,
      raisedHalalas: Number(p.raisedHalalas),
      backersCount: p.backersCount,
      platformPartner: p.platformPartner,
      createdAt: p.createdAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString() ?? null,
      // CC-04 — admin review feedback surfaced to the creator.
      reviewFeedback: p.reviewFeedback ?? null,
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      // CC-14 — pause state + cumulative paused time (7-day cap).
      pausedAt: p.pausedAt?.toISOString() ?? null,
      pausedMsAccrued: Number(p.pausedMsAccrued),
      // CC-22 SEO + CC-20 scheduled launch.
      slug: p.slug ?? null,
      ogImage: p.ogImage ?? null,
      metaDescription: p.metaDescription ?? null,
      scheduledLaunchAt: p.scheduledLaunchAt?.toISOString() ?? null,
      rewardTiers: p.rewardTiers?.map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k,
            typeof v === 'bigint' ? Number(v) : v,
          ]),
        ),
      ),
    };
  }

  private async requireOwned(creatorId: string, projectId: string): Promise<Project> {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.createdById !== creatorId) throw new ForbiddenException('not your project');
    return proj;
  }
}
