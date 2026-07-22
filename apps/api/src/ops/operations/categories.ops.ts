import { z } from 'zod';

import { isExcludedCategory } from '../../categories/excluded';

import type { OperationDef } from '../operation.types';
import type { CategoriesService } from '../../categories/categories.service';

/**
 * Batch OPS (registry completion) — CONTENT-tier taxonomy operations.
 *
 * The two-level category tree (Batch CAT) is the ONLY taxonomy projects
 * attach to, so its edits are governed here rather than through raw field
 * writes:
 *  · BUG-2 runtime guard — the permanently excluded taxonomy (Music,
 *    LGBTQIA+, occult/divination, romance) can never be re-introduced by an
 *    operator; create/update refuse via isExcludedCategory(), the SAME
 *    constants the seed guard (exclusions-guard.spec.ts) enforces.
 *  · Depth policy — the tree is exactly two levels: a parent must itself be
 *    top-level.
 *  · No delete operation ON PURPOSE — Project.categoryId is onDelete:SetNull,
 *    so deleting a category silently orphans every attached project.
 *    Deactivation (set-active) is the reversible way to retire a node.
 *
 * The public tree is memoised for 60s in CategoriesService; every mutation
 * invalidates it in afterCommit so operators never wait a minute to see
 * their own change.
 */

export interface CategoriesOpsDeps {
  categories: CategoriesService;
}

const kebabSlug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(60);

export function categoriesOps(deps: CategoriesOpsDeps): Array<OperationDef<never, unknown>> {
  /* ── create ────────────────────────────────────────────────────────── */
  const createInput = z.object({
    slug: kebabSlug,
    nameAr: z.string().min(2).max(60),
    nameEn: z.string().min(2).max(60).optional(),
    parentId: z.string().uuid().optional(),
    sortOrder: z.number().int().optional(),
  });

  const create: OperationDef<z.infer<typeof createInput>, { id: string }> = {
    key: 'content.categories.create',
    titleAr: 'إنشاء فئة',
    descriptionAr:
      'إضافة فئة رئيسية أو فرعية إلى شجرة التصنيف (مستويان كحد أقصى). لا توجد عملية حذف عمداً: حذف الفئة يفصل المشاريع المرتبطة بها بلا رجعة (SetNull)، لذا التراجع يكون بإلغاء التفعيل عبر content.categories.set-active.',
    inputSchema: createInput,
    permission: 'content.categories',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.categories.set-active',
    requiresReason: false,
    preconditions: [
      {
        // BUG-2 — الاستبعادات الثقافية الدائمة تُرفض في وقت التشغيل أيضاً،
        // لا في السيد فقط.
        code: 'excluded-category',
        reasonAr: 'الفئة تلامس تصنيفاً مستبعداً نهائياً (استبعاد ثقافي دائم — BUG-2)',
        check: async (_db, input) =>
          !isExcludedCategory({ slug: input.slug, nameAr: input.nameAr, nameEn: input.nameEn }),
      },
      {
        code: 'parent-missing',
        reasonAr: 'الفئة الأم غير موجودة',
        check: async (db, input) =>
          !input.parentId ||
          !!(await db.category.findUnique({
            where: { id: input.parentId },
            select: { id: true },
          })),
      },
      {
        // الشجرة مستويان بالضبط — الأم يجب أن تكون فئة رئيسية.
        code: 'parent-not-toplevel',
        reasonAr: 'الفئة الأم ليست فئة رئيسية — الشجرة مستويان كحد أقصى',
        check: async (db, input) => {
          if (!input.parentId) return true;
          const parent = await db.category.findUnique({
            where: { id: input.parentId },
            select: { parentId: true },
          });
          return !parent || parent.parentId === null;
        },
      },
      {
        // فريد داخل النطاق: نفس الأم — وللرئيسية أيضاً لا رئيسية أخرى بنفس
        // المُعرّف (الفهرس الجزئي في الهجرة).
        code: 'slug-taken',
        reasonAr: 'المُعرّف (slug) مستخدَم بالفعل ضمن نفس النطاق',
        check: async (db, input) =>
          !(await db.category.findFirst({
            where: { slug: input.slug, parentId: input.parentId ?? null },
            select: { id: true },
          })),
      },
    ],
    async dryRun(_db, input) {
      return {
        summaryAr: `ستُنشأ ${input.parentId ? 'فئة فرعية' : 'فئة رئيسية'} «${input.nameAr}» (${input.slug}) — مفعّلة`,
        before: null,
        after: {
          slug: input.slug,
          nameAr: input.nameAr,
          nameEn: input.nameEn ?? null,
          parentId: input.parentId ?? null,
          isActive: true,
        },
      };
    },
    async execute(tx, input) {
      // الترتيب الافتراضي: آخر النطاق (max+1) حتى لا تقفز الفئة الجديدة
      // إلى صدارة القائمة.
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const last = await tx.category.findFirst({
          where: { parentId: input.parentId ?? null },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        });
        sortOrder = (last?.sortOrder ?? 0) + 1;
      }
      const row = await tx.category.create({
        data: {
          slug: input.slug,
          nameAr: input.nameAr,
          nameEn: input.nameEn ?? input.slug,
          parentId: input.parentId ?? null,
          sortOrder,
          isActive: true,
        },
      });
      return { id: row.id };
    },
    async afterCommit() {
      deps.categories.invalidate();
    },
  };

  /* ── update ────────────────────────────────────────────────────────── */
  const updateInput = z
    .object({
      categoryId: z.string().uuid(),
      slug: kebabSlug.optional(),
      nameAr: z.string().min(2).max(60).optional(),
      nameEn: z.string().min(2).max(60).optional(),
    })
    .refine((v) => v.slug !== undefined || v.nameAr !== undefined || v.nameEn !== undefined, {
      message: 'حقل واحد على الأقل مطلوب للتعديل',
    });

  const update: OperationDef<z.infer<typeof updateInput>, { id: string }> = {
    key: 'content.categories.update',
    titleAr: 'تعديل فئة',
    descriptionAr: 'إعادة تسمية فئة أو تغيير مُعرّفها — لا يمس مكانها في الشجرة ولا حالتها.',
    inputSchema: updateInput as unknown as z.ZodType<z.infer<typeof updateInput>>,
    permission: 'content.categories',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.categories.update',
    requiresReason: false,
    preconditions: [
      {
        code: 'category-missing',
        reasonAr: 'الفئة غير موجودة',
        check: async (db, input) =>
          !!(await db.category.findUnique({
            where: { id: input.categoryId },
            select: { id: true },
          })),
      },
      {
        // BUG-2 — التعديل لا يهرّب تصنيفاً مستبعداً عبر إعادة التسمية.
        code: 'excluded-category',
        reasonAr: 'القيم الجديدة تلامس تصنيفاً مستبعداً نهائياً (استبعاد ثقافي دائم — BUG-2)',
        check: async (_db, input) =>
          !isExcludedCategory({ slug: input.slug, nameAr: input.nameAr, nameEn: input.nameEn }),
      },
      {
        code: 'slug-taken',
        reasonAr: 'المُعرّف (slug) مستخدَم بالفعل ضمن نفس النطاق',
        check: async (db, input) => {
          if (input.slug === undefined) return true;
          const cat = await db.category.findUnique({
            where: { id: input.categoryId },
            select: { parentId: true },
          });
          if (!cat) return true; // category-missing يرفض قبلنا
          return !(await db.category.findFirst({
            where: {
              slug: input.slug,
              parentId: cat.parentId ?? null,
              NOT: { id: input.categoryId },
            },
            select: { id: true },
          }));
        },
      },
    ],
    async dryRun(db, input) {
      const cat = await db.category.findUnique({
        where: { id: input.categoryId },
        select: { slug: true, nameAr: true, nameEn: true },
      });
      const changed = (['slug', 'nameAr', 'nameEn'] as const).filter(
        (k) => input[k] !== undefined,
      );
      return {
        summaryAr: `ستُعدَّل فئة «${cat?.nameAr ?? input.categoryId}» (${changed.join('، ')})`,
        before: cat ? { slug: cat.slug, nameAr: cat.nameAr, nameEn: cat.nameEn } : null,
        after: {
          slug: input.slug ?? cat?.slug,
          nameAr: input.nameAr ?? cat?.nameAr,
          nameEn: input.nameEn ?? cat?.nameEn,
        },
      };
    },
    async execute(tx, input) {
      const data: Record<string, string> = {};
      if (input.slug !== undefined) data.slug = input.slug;
      if (input.nameAr !== undefined) data.nameAr = input.nameAr;
      if (input.nameEn !== undefined) data.nameEn = input.nameEn;
      const row = await tx.category.update({ where: { id: input.categoryId }, data });
      return { id: row.id };
    },
    async afterCommit() {
      deps.categories.invalidate();
    },
  };

  /* ── set-active ────────────────────────────────────────────────────── */
  const setActiveInput = z.object({
    categoryId: z.string().uuid(),
    isActive: z.boolean(),
  });

  const setActive: OperationDef<z.infer<typeof setActiveInput>, { id: string; isActive: boolean }> = {
    key: 'content.categories.set-active',
    titleAr: 'تفعيل/إلغاء تفعيل فئة',
    descriptionAr:
      'إخفاء الفئة من الشجرة العامة أو إعادتها. المشاريع المرتبطة تحتفظ بفئتها — الإخفاء عرضي فقط، وهو بديل الحذف المعتمد.',
    inputSchema: setActiveInput,
    permission: 'content.categories',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.categories.set-active',
    requiresReason: false,
    preconditions: [
      {
        code: 'category-missing',
        reasonAr: 'الفئة غير موجودة',
        check: async (db, input) =>
          !!(await db.category.findUnique({
            where: { id: input.categoryId },
            select: { id: true },
          })),
      },
      {
        code: 'no-change',
        reasonAr: 'الفئة على هذه الحالة بالفعل — لا تغيير',
        check: async (db, input) => {
          const cat = await db.category.findUnique({
            where: { id: input.categoryId },
            select: { isActive: true },
          });
          return !cat || cat.isActive !== input.isActive;
        },
      },
    ],
    async dryRun(db, input) {
      const cat = await db.category.findUnique({
        where: { id: input.categoryId },
        select: { nameAr: true, parentId: true, isActive: true },
      });
      const projectsAttached = await db.project.count({
        where: { categoryId: input.categoryId },
      });
      const counts: Record<string, number> = { projectsAttached };
      if (!input.isActive && cat?.parentId === null) {
        counts.childCategories = await db.category.count({
          where: { parentId: input.categoryId },
        });
      }
      return {
        summaryAr: input.isActive
          ? `ستُعاد فئة «${cat?.nameAr ?? input.categoryId}» إلى الشجرة العامة`
          : `ستُخفى فئة «${cat?.nameAr ?? input.categoryId}» من الشجرة — ${projectsAttached} مشروعاً يحتفظ بفئته لكن الشجرة تخفيها`,
        before: cat ? { isActive: cat.isActive } : null,
        after: { isActive: input.isActive },
        counts,
      };
    },
    async execute(tx, input) {
      const row = await tx.category.update({
        where: { id: input.categoryId },
        data: { isActive: input.isActive },
      });
      return { id: row.id, isActive: input.isActive };
    },
    async afterCommit() {
      deps.categories.invalidate();
    },
  };

  /* ── reorder ───────────────────────────────────────────────────────── */
  const reorderInput = z.object({
    /** null = ترتيب الفئات الرئيسية؛ UUID = ترتيب أبناء تلك الفئة. */
    parentId: z.string().uuid().nullable(),
    orderedIds: z.array(z.string().uuid()).min(1),
  });

  const reorder: OperationDef<z.infer<typeof reorderInput>, { reordered: number }> = {
    key: 'content.categories.reorder',
    titleAr: 'إعادة ترتيب الفئات',
    descriptionAr:
      'يعيد ترتيب فئات نطاق واحد (الرئيسية أو أبناء فئة) حسب القائمة المرسلة — الفهرس يصبح sortOrder.',
    inputSchema: reorderInput,
    permission: 'content.categories',
    riskTier: 'CONTENT',
    reversible: true,
    compensatingKey: 'content.categories.reorder',
    requiresReason: false,
    preconditions: [
      {
        code: 'duplicate-ids',
        reasonAr: 'القائمة تحوي معرّفات مكررة',
        check: async (_db, input) => new Set(input.orderedIds).size === input.orderedIds.length,
      },
      {
        // كل معرّف موجود وينتمي إلى النطاق نفسه — لا خلط بين نطاقين.
        code: 'ids-scope-mismatch',
        reasonAr: 'معرّف أو أكثر غير موجود أو لا ينتمي إلى هذا النطاق',
        check: async (db, input) => {
          const inScope = await db.category.count({
            where: { id: { in: input.orderedIds }, parentId: input.parentId },
          });
          return inScope === input.orderedIds.length;
        },
      },
    ],
    async dryRun(db, input) {
      const rows = await db.category.findMany({
        where: { parentId: input.parentId },
        orderBy: [{ sortOrder: 'asc' }],
        select: { id: true, slug: true },
      });
      const slugOf = new Map(rows.map((r) => [r.id, r.slug]));
      return {
        summaryAr: `سيُعاد ترتيب ${input.orderedIds.length} فئة في ${input.parentId ? 'نطاق فرعي' : 'النطاق الرئيسي'}`,
        before: { order: rows.map((r) => r.slug) },
        after: { order: input.orderedIds.map((id) => slugOf.get(id) ?? id) },
        counts: { categories: input.orderedIds.length },
      };
    },
    async execute(tx, input) {
      for (let i = 0; i < input.orderedIds.length; i++) {
        await tx.category.update({
          where: { id: input.orderedIds[i] },
          data: { sortOrder: i },
        });
      }
      return { reordered: input.orderedIds.length };
    },
    async afterCommit() {
      deps.categories.invalidate();
    },
  };

  return [create, update, setActive, reorder] as unknown as Array<OperationDef<never, unknown>>;
}
