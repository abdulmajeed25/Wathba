import { z } from 'zod';

import type { OperationDef } from '../operation.types';

/**
 * OPS Part 0 — CONTENT tier (free editing, still audited): editorial cards,
 * homepage sections, collections. Direct CRUD through the registry so every
 * change lands in the audit trail with an actor; no reason required.
 *
 * The excluded-slug guard from Batch SEARCH applies here from day 0: the
 * permanently excluded taxonomy can never be smuggled back in as a
 * collection slug or editorial content.
 */

/** Permanent cultural exclusions — mirror of the Batch SEARCH policy. */
const EXCLUDED_TERMS = ['music', 'موسيق', 'romance', 'رومانس', 'lgbt', 'tarot', 'occult', 'تنجيم'];
const containsExcluded = (s: string): boolean =>
  EXCLUDED_TERMS.some((t) => s.toLowerCase().includes(t));

const CARD_KINDS = [
  'HERO_BANNER', 'ANNOUNCEMENT', 'SUCCESS_STORY', 'CREATOR_INTERVIEW',
  'RESOURCE', 'TIP', 'TRUST_GUIDE',
] as const;

export function contentOps(): Array<OperationDef<never, unknown>> {
  /* ── editorial cards ───────────────────────────────────────────────── */
  const cardCreateInput = z.object({
    kind: z.enum(CARD_KINDS),
    titleAr: z.string().trim().min(3).max(120),
    bodyAr: z.string().trim().min(10).max(600),
    bodyLongAr: z.string().max(20000).optional(),
    slug: z.string().max(120).optional(),
    imageUrl: z.string().max(600).optional(),
    linkUrl: z.string().max(400).optional(),
    linkLabelAr: z.string().max(60).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  });

  const noExcludedContent = {
    code: 'excluded-content',
    reasonAr: 'المحتوى يلامس فئة مستبعدة نهائياً (سياسة الاستبعادات الثقافية)',
    check: async (_db: unknown, input: { titleAr?: string; slug?: string }) =>
      !containsExcluded(`${input.titleAr ?? ''} ${input.slug ?? ''}`),
  };

  const cardCreate: OperationDef<z.infer<typeof cardCreateInput>, { id: string }> = {
    key: 'content.editorial.card.create',
    titleAr: 'إنشاء بطاقة تحريرية',
    descriptionAr: 'بطاقة جديدة للرئيسية (لافتة/إعلان/قصة/حوار/مورد/نصيحة/دليل ثقة).',
    inputSchema: cardCreateInput,
    permission: 'content.editorial',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.editorial.card.delete',
    requiresReason: false,
    preconditions: [noExcludedContent as never],
    async dryRun(_db, input) {
      return {
        summaryAr: `ستُنشأ بطاقة ${input.kind}: «${input.titleAr}»`,
        before: null,
        after: { kind: input.kind, titleAr: input.titleAr, isActive: input.isActive ?? true },
      };
    },
    async execute(tx, input) {
      const row = await tx.editorialCard.create({ data: input });
      return { ...row, id: row.id } as unknown as { id: string };
    },
  };

  const cardUpdateInput = cardCreateInput.partial().extend({ id: z.string().uuid() });
  const cardUpdate: OperationDef<z.infer<typeof cardUpdateInput>, { id: string }> = {
    key: 'content.editorial.card.update',
    titleAr: 'تعديل بطاقة تحريرية',
    descriptionAr: 'تعديل حقول بطاقة قائمة (يشمل الإخفاء عبر isActive).',
    inputSchema: cardUpdateInput,
    permission: 'content.editorial',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.editorial.card.update',
    requiresReason: false,
    preconditions: [
      {
        code: 'card-missing',
        reasonAr: 'البطاقة غير موجودة',
        check: async (db, input) =>
          !!(await db.editorialCard.findUnique({ where: { id: input.id }, select: { id: true } })),
      },
      noExcludedContent as never,
    ],
    async dryRun(db, input) {
      const before = await db.editorialCard.findUnique({ where: { id: input.id } });
      const { id: _id, ...changes } = input;
      return {
        summaryAr: `ستُعدَّل «${before?.titleAr}» (${Object.keys(changes).join('، ') || 'لا تغيير'})`,
        before: before ? { titleAr: before.titleAr, isActive: before.isActive } : null,
        after: changes as Record<string, unknown>,
      };
    },
    async execute(tx, input) {
      const { id, ...data } = input;
      const row = await tx.editorialCard.update({ where: { id }, data });
      return { ...row, id: row.id } as unknown as { id: string };
    },
  };

  const cardDeleteInput = z.object({ id: z.string().uuid() });
  const cardDelete: OperationDef<z.infer<typeof cardDeleteInput>, { ok: true }> = {
    key: 'content.editorial.card.delete',
    titleAr: 'حذف بطاقة تحريرية',
    descriptionAr: 'حذف نهائي لبطاقة من الرئيسية (الإخفاء المؤقت عبر التعديل isActive=false).',
    inputSchema: cardDeleteInput,
    permission: 'content.editorial',
    riskTier: 'CONTENT',
    reversible: false,
    requiresReason: false,
    preconditions: [
      {
        code: 'card-missing',
        reasonAr: 'البطاقة غير موجودة',
        check: async (db, input) =>
          !!(await db.editorialCard.findUnique({ where: { id: input.id }, select: { id: true } })),
      },
    ],
    async dryRun(db, input) {
      const c = await db.editorialCard.findUnique({ where: { id: input.id } });
      return {
        summaryAr: `ستُحذف «${c?.titleAr}» نهائياً`,
        before: c ? { titleAr: c.titleAr, kind: c.kind } : null,
        after: null,
      };
    },
    async execute(tx, input) {
      await tx.editorialCard.delete({ where: { id: input.id } });
      return { ok: true as const };
    },
  };

  /* ── homepage sections ─────────────────────────────────────────────── */
  const sectionInput = z.object({
    key: z.string().min(2).max(60),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  });
  const sectionUpdate: OperationDef<z.infer<typeof sectionInput>, { key: string }> = {
    key: 'content.homepage-section.update',
    titleAr: 'تبديل/ترتيب قسم الرئيسية',
    descriptionAr: 'يظهر/يخفي قسماً أو يغيّر ترتيبه — القسم الفارغ يُخفى تلقائياً في العرض.',
    inputSchema: sectionInput,
    permission: 'content.editorial',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.homepage-section.update',
    requiresReason: false,
    preconditions: [
      {
        code: 'section-missing',
        reasonAr: 'قسم الرئيسية غير معروف',
        check: async (db, input) =>
          !!(await db.homepageSection.findUnique({ where: { key: input.key } })),
      },
    ],
    async dryRun(db, input) {
      const s = await db.homepageSection.findUnique({ where: { key: input.key } });
      return {
        summaryAr: `سيُحدَّث قسم ${input.key}`,
        before: s ? { isActive: s.isActive, sortOrder: s.sortOrder } : null,
        after: {
          isActive: input.isActive ?? s?.isActive,
          sortOrder: input.sortOrder ?? s?.sortOrder,
        },
      };
    },
    async execute(tx, input) {
      const { key, ...data } = input;
      const row = await tx.homepageSection.update({ where: { key }, data });
      return { ...row, key: row.key } as unknown as { key: string };
    },
  };

  /* ── collections ───────────────────────────────────────────────────── */
  const collectionCreateInput = z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),
    nameAr: z.string().trim().min(2).max(80),
    descriptionAr: z.string().trim().min(4).max(400),
    sortOrder: z.number().int().min(0).optional(),
  });

  const collectionCreate: OperationDef<z.infer<typeof collectionCreateInput>, { id: string }> = {
    key: 'content.collections.create',
    titleAr: 'إنشاء حملة وثبة (مجموعة)',
    descriptionAr: 'مجموعة مُنسَّقة تظهر في القائمة والرئيسية عند التفعيل.',
    inputSchema: collectionCreateInput,
    permission: 'content.collections',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.collections.delete',
    requiresReason: false,
    preconditions: [
      {
        code: 'slug-taken',
        reasonAr: 'المُعرّف (slug) مستخدَم بالفعل',
        check: async (db, input) =>
          !(await db.collection.findUnique({ where: { slug: input.slug }, select: { id: true } })),
      },
      {
        code: 'excluded-content',
        reasonAr: 'المحتوى يلامس فئة مستبعدة نهائياً (سياسة الاستبعادات الثقافية)',
        check: async (_db, input) => !containsExcluded(`${input.slug} ${input.nameAr}`),
      },
    ],
    async dryRun(_db, input) {
      return {
        summaryAr: `ستُنشأ حملة «${input.nameAr}» (${input.slug}) — غير مفعّلة حتى تُفعَّل صراحة`,
        before: null,
        after: { ...input, isActive: false },
      };
    },
    async execute(tx, input) {
      const row = await tx.collection.create({
        data: { ...input, sortOrder: input.sortOrder ?? 0 },
      });
      return { ...row, id: row.id } as unknown as { id: string };
    },
  };

  const collectionUpdateInput = z.object({
    id: z.string().uuid(),
    nameAr: z.string().trim().min(2).max(80).optional(),
    descriptionAr: z.string().trim().min(4).max(400).optional(),
    isActive: z.boolean().optional(),
    showInMenu: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  });
  const collectionUpdate: OperationDef<z.infer<typeof collectionUpdateInput>, { id: string }> = {
    key: 'content.collections.update',
    titleAr: 'تعديل حملة وثبة',
    descriptionAr: 'تفعيل/إخفاء/إظهار في القائمة/إعادة تسمية/ترتيب.',
    inputSchema: collectionUpdateInput,
    permission: 'content.collections',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.collections.update',
    requiresReason: false,
    preconditions: [
      {
        code: 'collection-missing',
        reasonAr: 'الحملة غير موجودة',
        check: async (db, input) =>
          !!(await db.collection.findUnique({ where: { id: input.id }, select: { id: true } })),
      },
    ],
    async dryRun(db, input) {
      const c = await db.collection.findUnique({ where: { id: input.id } });
      const { id: _id, ...changes } = input;
      return {
        summaryAr: `ستُعدَّل حملة «${c?.nameAr}»`,
        before: c ? { isActive: c.isActive, showInMenu: c.showInMenu, nameAr: c.nameAr } : null,
        after: changes as Record<string, unknown>,
      };
    },
    async execute(tx, input) {
      const { id, ...data } = input;
      const row = await tx.collection.update({ where: { id }, data });
      return { ...row, id: row.id } as unknown as { id: string };
    },
  };

  const collectionDeleteInput = z.object({ id: z.string().uuid() });
  const collectionDelete: OperationDef<z.infer<typeof collectionDeleteInput>, { deleted: true }> = {
    key: 'content.collections.delete',
    titleAr: 'حذف حملة وثبة',
    descriptionAr: 'حذف المجموعة (تُفك تعيينات المشاريع تلقائياً عبر cascade).',
    inputSchema: collectionDeleteInput,
    permission: 'content.collections',
    riskTier: 'CONTENT',
    reversible: false,
    requiresReason: false,
    preconditions: [
      {
        code: 'collection-missing',
        reasonAr: 'الحملة غير موجودة',
        check: async (db, input) =>
          !!(await db.collection.findUnique({ where: { id: input.id }, select: { id: true } })),
      },
    ],
    async dryRun(db, input) {
      const c = await db.collection.findUnique({
        where: { id: input.id },
        include: { _count: { select: { projects: true } } },
      });
      return {
        summaryAr: `ستُحذف «${c?.nameAr}» وتُفك ${c?._count.projects ?? 0} تعيينات مشاريع`,
        before: c ? { nameAr: c.nameAr, assignedProjects: c._count.projects } : null,
        after: null,
        counts: { unassigned: c?._count.projects ?? 0 },
      };
    },
    async execute(tx, input) {
      await tx.collection.delete({ where: { id: input.id } });
      return { deleted: true as const };
    },
  };

  const assignInput = z.object({ collectionId: z.string().uuid(), projectId: z.string().uuid() });
  const collectionAssign: OperationDef<z.infer<typeof assignInput>, { assigned: true }> = {
    key: 'content.collections.assign',
    titleAr: 'إسناد مشروع إلى حملة',
    descriptionAr: 'إسناد idempotent (التكرار لا يضيف صفاً).',
    inputSchema: assignInput,
    permission: 'content.collections',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.collections.unassign',
    requiresReason: false,
    preconditions: [
      {
        code: 'collection-missing',
        reasonAr: 'الحملة غير موجودة',
        check: async (db, input) =>
          !!(await db.collection.findUnique({
            where: { id: input.collectionId },
            select: { id: true },
          })),
      },
      {
        code: 'project-missing',
        reasonAr: 'المشروع غير موجود',
        check: async (db, input) =>
          !!(await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } })),
      },
    ],
    async dryRun(db, input) {
      const [c, p] = await Promise.all([
        db.collection.findUnique({ where: { id: input.collectionId }, select: { nameAr: true } }),
        db.project.findUnique({ where: { id: input.projectId }, select: { titleAr: true } }),
      ]);
      return {
        summaryAr: `سيُسند «${p?.titleAr}» إلى حملة «${c?.nameAr}»`,
        before: null,
        after: { collectionId: input.collectionId, projectId: input.projectId },
      };
    },
    async execute(tx, input) {
      await tx.projectCollection.upsert({
        where: {
          collectionId_projectId: {
            collectionId: input.collectionId,
            projectId: input.projectId,
          },
        },
        create: { collectionId: input.collectionId, projectId: input.projectId },
        update: {},
      });
      return { assigned: true as const };
    },
  };

  const collectionUnassign: OperationDef<z.infer<typeof assignInput>, { assigned: false }> = {
    key: 'content.collections.unassign',
    titleAr: 'فك إسناد مشروع من حملة',
    descriptionAr: 'يزيل المشروع من المجموعة (لا يمس المشروع نفسه).',
    inputSchema: assignInput,
    permission: 'content.collections',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.collections.assign',
    requiresReason: false,
    preconditions: [],
    async dryRun(db, input) {
      const c = await db.collection.findUnique({
        where: { id: input.collectionId },
        select: { nameAr: true },
      });
      return {
        summaryAr: `سيُفك الإسناد من حملة «${c?.nameAr ?? input.collectionId}»`,
        before: { collectionId: input.collectionId, projectId: input.projectId },
        after: null,
      };
    },
    async execute(tx, input) {
      await tx.projectCollection.deleteMany({
        where: { collectionId: input.collectionId, projectId: input.projectId },
      });
      return { assigned: false as const };
    },
  };

  return [
    cardCreate, cardUpdate, cardDelete, sectionUpdate,
    collectionCreate, collectionUpdate, collectionDelete, collectionAssign, collectionUnassign,
  ] as unknown as Array<OperationDef<never, unknown>>;
}
