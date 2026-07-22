import { EmailService } from './email.service';
import { emailTemplates } from './email-templates';
import type { PrismaService } from '../prisma/prisma.service';

/** Minimal PrismaService double exposing just the override table findMany. */
function prismaWith(rows: Array<{ key: string; subjectAr: string; bodyAr: string }>) {
  const findMany = jest.fn().mockResolvedValue(rows);
  return {
    prisma: { emailTemplateOverride: { findMany } } as unknown as PrismaService,
    findMany,
  };
}

/** STAKES/S-3 — EmailService stub behaviour + Arabic RTL templates. */
describe('email templates', () => {
  it('pledge receipt carries the project, SAR amount and RTL layout', () => {
    const { subject, html } = emailTemplates.pledgeReceipt({
      projectTitle: 'سِرب',
      amountHalalas: 5000,
      tierTitle: 'باقة رقمية',
    });
    expect(subject).toContain('سِرب');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('باقة رقمية');
    expect(html).toContain('ر.س'); // amount rendered in SAR (ar-SA locale → Arabic-indic digits)
  });

  it('funded vs failed have distinct, correct subjects', () => {
    expect(emailTemplates.projectFunded({ projectTitle: 'x', amountHalalas: 100 }).subject).toContain('نجحت');
    expect(emailTemplates.projectFailed({ projectTitle: 'x', amountHalalas: 100 }).subject).toContain('ردّ');
  });

  it('reviewed switches copy on approve/reject and includes feedback', () => {
    expect(emailTemplates.projectReviewed({ projectTitle: 'x', approved: true }).subject).toContain('الموافقة');
    const rej = emailTemplates.projectReviewed({ projectTitle: 'x', approved: false, feedback: 'وضّح الميزانية' });
    expect(rej.html).toContain('وضّح الميزانية');
  });
});

describe('EmailService (stub mode)', () => {
  it('stubs (no provider configured), records the send, and never throws', async () => {
    const svc = new EmailService();
    const res = await svc.pledgeReceipt('backer@wathba.sa', { projectTitle: 'سِرب', amountHalalas: 5000 });
    expect(res).toEqual({ sent: false, stubbed: true });
    expect(svc.sent.at(-1)).toEqual({ to: 'backer@wathba.sa', subject: expect.stringContaining('سِرب'), html: expect.any(String) });
  });

  it('hydrates {{APP_URL}} / {{PREFS_URL}} placeholders (welcome)', async () => {
    const svc = new EmailService();
    // The welcome template embeds {{APP_URL}}; deliver() must not leave the raw token.
    await svc.welcome('u@wathba.sa', 'أحمد');
    expect(svc.sent.at(-1)?.subject).toContain('توثيق');
  });
});

/**
 * OPS-GAPS Y2 — the keyed override plumbing. The load-bearing guarantee: with
 * NO override row a helper delivers exactly what deliver() of the raw template
 * would — byte-identical, money-critical templates included.
 */
describe('EmailService — DB template overrides', () => {
  it('BEHAVIOUR-PRESERVING: an un-overridden template is byte-identical to a raw deliver()', async () => {
    // No Prisma client → no overrides can ever apply (the dev/CI default).
    const svc = new EmailService();
    await svc.pledgeReceipt('backer@wathba.sa', { projectTitle: 'سِرب', amountHalalas: 5000 });
    const keyed = svc.sent.at(-1);

    // Control: deliver the SAME code template straight through the raw sender.
    const control = new EmailService();
    await control.deliver(
      'backer@wathba.sa',
      emailTemplates.pledgeReceipt({ projectTitle: 'سِرب', amountHalalas: 5000 }),
    );
    expect(keyed).toEqual(control.sent.at(-1));
  });

  it('holds byte-identity even WITH a Prisma client when no row matches the key', async () => {
    const { prisma } = prismaWith([]); // table empty → every key falls through
    const svc = new EmailService(prisma);
    await svc.payoutSent('creator@wathba.sa', { projectTitle: 'سِرب', amountHalalas: 900000 });
    const control = new EmailService();
    await control.deliver(
      'creator@wathba.sa',
      emailTemplates.payoutSent({ projectTitle: 'سِرب', amountHalalas: 900000 }),
    );
    expect(svc.sent.at(-1)).toEqual(control.sent.at(-1));
  });

  it('applies the override (subject + body wrapped in the shared layout) when a row exists', async () => {
    const { prisma } = prismaWith([
      { key: 'verification', subjectAr: 'موضوع مخصص من المشغّل', bodyAr: '<p>نص مخصص للتفعيل</p>' },
    ]);
    const svc = new EmailService(prisma);
    await svc.verification('u@wathba.sa', 'https://wathba.sa/verify?t=abc');
    const sent = svc.sent.at(-1)!;
    expect(sent.subject).toBe('موضوع مخصص من المشغّل');
    expect(sent.html).toContain('نص مخصص للتفعيل');
    expect(sent.html).toContain('dir="rtl"'); // still wrapped in the brand layout
    // the overridden template drops the injected link (override is static copy)
    expect(sent.html).not.toContain('abc');

    // a DIFFERENT, un-overridden key still uses the code default
    await svc.welcome('u@wathba.sa', 'محمد');
    expect(svc.sent.at(-1)!.subject).toContain('توثيق');
  });

  it('caches overrides for the TTL and reloads only after invalidateTemplateCache()', async () => {
    const { prisma, findMany } = prismaWith([]);
    const svc = new EmailService(prisma);
    await svc.welcome('a@b.sa', 'x');
    await svc.welcome('a@b.sa', 'x');
    expect(findMany).toHaveBeenCalledTimes(1); // second send hits the 60s cache
    svc.invalidateTemplateCache();
    await svc.welcome('a@b.sa', 'x');
    expect(findMany).toHaveBeenCalledTimes(2); // cache dropped → reloaded
  });

  it('never throws (nor blocks the send) when the override lookup fails', async () => {
    const prisma = {
      emailTemplateOverride: { findMany: jest.fn().mockRejectedValue(new Error('db down')) },
    } as unknown as PrismaService;
    const svc = new EmailService(prisma);
    const res = await svc.refundCompleted('u@wathba.sa', { projectTitle: 'سِرب', amountHalalas: 5000 });
    expect(res).toEqual({ sent: false, stubbed: true });
    // fell back to the code default, unharmed
    expect(svc.sent.at(-1)!.subject).toContain('ردّ');
  });
});
