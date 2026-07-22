import { z } from 'zod';

import {
  TEMPLATE_KEYS,
  TEMPLATE_CATALOG_BY_KEY,
  renderOverride,
  type EmailContent,
  type EmailTemplateName,
} from '../../email/email-templates';

import type { OperationDef, ReadOnlyDb } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EmailService } from '../../email/email.service';

/**
 * OPS-GAPS Y2 — the governed comms (email-template) ops. SENSITIVE tier
 * (written reason, step-up, audited) because a template override changes the
 * copy every user receives — including the money-critical receipts.
 *
 *  · comms.template.set   — upsert an EmailTemplateOverride (operator's Arabic
 *    subject/body); afterCommit invalidates EmailService's 60s override cache
 *    so the new copy is live immediately.
 *  · comms.template.reset — delete the override; the code default takes over.
 *  · comms.template.test-send — orchestrated (it hits the mail path): sends the
 *    EFFECTIVE template (override if present, else the catalog sample) to an
 *    address so the operator can preview a real delivery.
 *
 * deps (import type only — RULE 2): `email` for cache invalidation + the
 * test-send delivery; `prisma` is present for symmetry but the override reads
 * inside execute go through the registry-supplied tx client.
 */

export interface CommsOpsDeps {
  prisma: PrismaService;
  email: EmailService;
}

const knownKey = {
  code: 'unknown-template',
  reasonAr: 'المفتاح غير موجود في كتالوج القوالب',
  check: async (_db: ReadOnlyDb, input: { key: string }) => input.key in TEMPLATE_CATALOG_BY_KEY,
};

/** The effective content on the handed db client: DB override wins, else the
 *  pre-rendered catalog sample. */
async function effectiveContent(db: ReadOnlyDb, key: EmailTemplateName): Promise<EmailContent> {
  const override = await db.emailTemplateOverride.findUnique({ where: { key } });
  return override ? renderOverride(override.subjectAr, override.bodyAr) : TEMPLATE_CATALOG_BY_KEY[key].sample;
}

export function commsOps(deps: CommsOpsDeps): Array<OperationDef<never, unknown>> {
  /* ── set ───────────────────────────────────────────────────────────── */
  const setInput = z.object({
    key: z.enum(TEMPLATE_KEYS),
    subjectAr: z.string().min(3),
    bodyAr: z.string().min(10),
  });

  const set: OperationDef<z.infer<typeof setInput>, { key: string; hadOverride: boolean }> = {
    key: 'comms.template.set',
    titleAr: 'تعديل قالب بريد',
    descriptionAr:
      'يكتب نصاً بديلاً (موضوع + متن) لقالب بريد من الكتالوج؛ يحلّ محلّ النص المبرمَج لكل الرسائل من هذا القالب — بما فيها الإيصالات المالية. عكسه = إعادة القالب إلى الافتراضي عبر comms.template.reset.',
    inputSchema: setInput,
    permission: 'settings.write',
    riskTier: 'SENSITIVE',
    reversible: true,
    compensatingKey: 'comms.template.reset',
    requiresReason: true,
    preconditions: [knownKey as never],
    async dryRun(db, input) {
      const cat = TEMPLATE_CATALOG_BY_KEY[input.key as EmailTemplateName];
      const existing = await db.emailTemplateOverride.findUnique({ where: { key: input.key } });
      return {
        summaryAr: `${existing ? 'سيُحدَّث' : 'سيُنشأ'} تجاوز لقالب «${cat?.labelAr ?? input.key}»${
          cat?.critical ? ' (قالب حرج)' : ''
        } — سيصل النص الجديد لكل مستلمي هذا القالب`,
        before: existing
          ? { subjectAr: existing.subjectAr, bodyAr: existing.bodyAr }
          : { subjectAr: cat?.sample.subject ?? null, source: 'الافتراضي (الكود)' },
        after: { subjectAr: input.subjectAr, bodyAr: input.bodyAr },
      };
    },
    async execute(tx, input, ctx) {
      const updatedById = /^[0-9a-f-]{36}$/i.test(ctx.actor.id) ? ctx.actor.id : null;
      const existing = await tx.emailTemplateOverride.findUnique({
        where: { key: input.key },
        select: { key: true },
      });
      await tx.emailTemplateOverride.upsert({
        where: { key: input.key },
        create: { key: input.key, subjectAr: input.subjectAr, bodyAr: input.bodyAr, updatedById },
        update: { subjectAr: input.subjectAr, bodyAr: input.bodyAr, updatedById },
      });
      return { key: input.key, hadOverride: !!existing };
    },
    async afterCommit() {
      deps.email.invalidateTemplateCache();
    },
  };

  /* ── reset ─────────────────────────────────────────────────────────── */
  const resetInput = z.object({ key: z.enum(TEMPLATE_KEYS) });

  const reset: OperationDef<z.infer<typeof resetInput>, { key: string; reset: boolean }> = {
    key: 'comms.template.reset',
    titleAr: 'إعادة قالب بريد إلى الافتراضي',
    descriptionAr:
      'يحذف تجاوز القالب فيعود النص المبرمَج (الافتراضي) هو المُرسَل. عكسه = كتابة تجاوز جديد عبر comms.template.set.',
    inputSchema: resetInput,
    permission: 'settings.write',
    riskTier: 'SENSITIVE',
    reversible: true,
    compensatingKey: 'comms.template.set',
    requiresReason: true,
    preconditions: [
      knownKey as never,
      {
        code: 'no-override',
        reasonAr: 'لا يوجد تجاوز لهذا القالب — هو على الافتراضي أصلاً',
        check: async (db, input) =>
          !!(await db.emailTemplateOverride.findUnique({
            where: { key: input.key },
            select: { key: true },
          })),
      },
    ],
    async dryRun(db, input) {
      const cat = TEMPLATE_CATALOG_BY_KEY[input.key as EmailTemplateName];
      const existing = await db.emailTemplateOverride.findUnique({ where: { key: input.key } });
      return {
        summaryAr: `سيُعاد قالب «${cat?.labelAr ?? input.key}» إلى نصه الافتراضي المبرمَج`,
        before: existing ? { subjectAr: existing.subjectAr, bodyAr: existing.bodyAr } : null,
        after: { subjectAr: cat?.sample.subject ?? null, source: 'الافتراضي (الكود)' },
      };
    },
    async execute(tx, input) {
      await tx.emailTemplateOverride.deleteMany({ where: { key: input.key } });
      return { key: input.key, reset: true };
    },
    async afterCommit() {
      deps.email.invalidateTemplateCache();
    },
  };

  /* ── test-send ─────────────────────────────────────────────────────── */
  const testSendInput = z.object({
    key: z.enum(TEMPLATE_KEYS),
    to: z.string().email(),
  });

  const testSend: OperationDef<z.infer<typeof testSendInput>, { sent: boolean; stubbed: boolean }> = {
    key: 'comms.template.test-send',
    titleAr: 'إرسال تجريبي لقالب بريد',
    descriptionAr:
      'يرسل النسخة السارية من القالب (التجاوز إن وُجد، وإلا الافتراضي) إلى عنوان بريد للمعاينة الحيّة. غير قابل للعكس — البريد المُرسَل لا يُسترد.',
    inputSchema: testSendInput,
    permission: 'settings.write',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: true,
    orchestrated: true,
    preconditions: [knownKey as never],
    async dryRun(db, input) {
      const cat = TEMPLATE_CATALOG_BY_KEY[input.key as EmailTemplateName];
      const content = await effectiveContent(db, input.key as EmailTemplateName);
      return {
        summaryAr: `سيُرسل قالب «${cat?.labelAr ?? input.key}» تجريبياً إلى ${input.to} — الإرسال لا يُعكس`,
        before: null,
        after: { to: input.to, subject: content.subject },
      };
    },
    // Orchestrated: the registry hands `this.prisma` as the tx client; we read
    // the current override through it, then deliver via the raw sender.
    async execute(tx, input) {
      const content = await effectiveContent(tx, input.key as EmailTemplateName);
      const res = await deps.email.deliver(input.to, content);
      return { sent: res.sent, stubbed: res.stubbed };
    },
  };

  return [set, reset, testSend] as unknown as Array<OperationDef<never, unknown>>;
}
