import { OperationsRegistry } from './operations.registry';
import { commsOps } from './operations/comms.ops';
import { TEMPLATE_CATALOG_BY_KEY } from '../email/email-templates';

import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';

/**
 * OPS-GAPS Y2 — the governed comms (email-template) ops:
 *  · comms.template.set   — upserts the override with the acting operator and
 *    invalidates the EmailService cache after commit
 *  · comms.template.reset — refuses when nothing to reset, else deletes + invalidates
 *  · comms.template.test-send — orchestrated: sends the EFFECTIVE template
 *    (override if present, else the catalog sample) via deps.email.deliver
 */

type Mock = jest.Mock;
interface MockModel {
  findUnique: Mock; findUniqueOrThrow: Mock; findFirst: Mock; findMany: Mock;
  count: Mock; create: Mock; update: Mock; updateMany: Mock;
  delete: Mock; deleteMany: Mock; upsert: Mock;
}
interface MockDb {
  emailTemplateOverride: MockModel;
  operationExecution: MockModel; auditLog: MockModel; operationProposal: MockModel;
  $transaction: Mock;
}

function model(): MockModel {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'row-1', ...data })),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

function buildPrisma(): MockDb {
  const prisma: MockDb = {
    emailTemplateOverride: model(),
    operationExecution: model(), auditLog: model(), operationProposal: model(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const asPrisma = (db: MockDb): PrismaService => db as unknown as PrismaService;

const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

const ctx = (over: Partial<OperationContext> = {}): OperationContext => ({
  actor: { id: ADMIN_ID, type: 'HUMAN', roles: ['OWNER'], permissions: ['*'] },
  reason: 'سبب اختباري كافٍ للطول',
  idempotencyKey: 'k1',
  stepUpVerifiedAt: new Date(),
  ...over,
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

function buildHarness() {
  const prisma = buildPrisma();
  const reg = new OperationsRegistry(asPrisma(prisma));
  reg.permissionPort = { has: () => true };
  const email = {
    invalidateTemplateCache: jest.fn(),
    deliver: jest.fn().mockResolvedValue({ sent: false, stubbed: true }),
  } as unknown as EmailService;
  for (const op of commsOps({ prisma: asPrisma(prisma), email })) reg.register(op);
  return { prisma, reg, email };
}

const emailMock = (email: EmailService) =>
  email as unknown as { invalidateTemplateCache: Mock; deliver: Mock };

describe('comms.template.set', () => {
  it('upserts the override with the acting operator and invalidates the cache after commit', async () => {
    const { reg, prisma, email } = buildHarness();
    prisma.emailTemplateOverride.findUnique.mockResolvedValue(null); // no prior override
    const out = await reg.execute(
      'comms.template.set',
      { key: 'verification', subjectAr: 'موضوع جديد', bodyAr: 'متن جديد كافٍ الطول' },
      ctx(),
    );
    expect(out.result).toEqual({ key: 'verification', hadOverride: false });
    expect(prisma.emailTemplateOverride.upsert).toHaveBeenCalledWith({
      where: { key: 'verification' },
      create: { key: 'verification', subjectAr: 'موضوع جديد', bodyAr: 'متن جديد كافٍ الطول', updatedById: ADMIN_ID },
      update: { subjectAr: 'موضوع جديد', bodyAr: 'متن جديد كافٍ الطول', updatedById: ADMIN_ID },
    });
    await flush();
    expect(emailMock(email).invalidateTemplateCache).toHaveBeenCalled();
  });

  it('rejects an unknown template key at the input gate (z.enum)', async () => {
    const { reg } = buildHarness();
    await expect(
      reg.execute(
        'comms.template.set',
        { key: 'not-a-template', subjectAr: 'موضوع', bodyAr: 'متن طويل كفاية' },
        ctx(),
      ),
    ).rejects.toBeDefined();
  });

  it('rejects a too-short subject/body (min-length input guard)', async () => {
    const { reg } = buildHarness();
    await expect(
      reg.execute('comms.template.set', { key: 'welcome', subjectAr: 'x', bodyAr: 'y' }, ctx()),
    ).rejects.toBeDefined();
  });

  it('dryRun labels a CRITICAL template and shows before/after without writing', async () => {
    const { reg, prisma } = buildHarness();
    prisma.emailTemplateOverride.findUnique.mockResolvedValue(null);
    const dry = await reg.dryRun(
      'comms.template.set',
      { key: 'payoutSent', subjectAr: 'دفعتك في الطريق', bodyAr: 'حوّلنا دفعتك بنجاح.' },
      ctx(),
    );
    expect(dry.ok).toBe(true);
    expect(dry.preview!.summaryAr).toContain('حرج'); // payoutSent is critical
    expect(dry.preview!.after).toMatchObject({ subjectAr: 'دفعتك في الطريق' });
    expect(prisma.emailTemplateOverride.upsert).not.toHaveBeenCalled();
  });
});

describe('comms.template.reset', () => {
  it('refuses when the template has no override (no-override)', async () => {
    const { reg, prisma } = buildHarness();
    prisma.emailTemplateOverride.findUnique.mockResolvedValue(null);
    await expect(
      reg.execute('comms.template.reset', { key: 'welcome' }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'no-override' }) });
    expect(prisma.emailTemplateOverride.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes the override and invalidates the cache after commit', async () => {
    const { reg, prisma, email } = buildHarness();
    prisma.emailTemplateOverride.findUnique.mockResolvedValue({ key: 'welcome' });
    const out = await reg.execute('comms.template.reset', { key: 'welcome' }, ctx());
    expect(out.result).toEqual({ key: 'welcome', reset: true });
    expect(prisma.emailTemplateOverride.deleteMany).toHaveBeenCalledWith({ where: { key: 'welcome' } });
    await flush();
    expect(emailMock(email).invalidateTemplateCache).toHaveBeenCalled();
  });
});

describe('comms.template.test-send', () => {
  it('sends the DEFAULT catalog sample when no override exists', async () => {
    const { reg, prisma, email } = buildHarness();
    prisma.emailTemplateOverride.findUnique.mockResolvedValue(null);
    const out = await reg.execute(
      'comms.template.test-send',
      { key: 'pledgeReceipt', to: 'ops@wathba.sa' },
      ctx(),
    );
    expect(out.result).toEqual({ sent: false, stubbed: true });
    const [to, content] = emailMock(email).deliver.mock.calls[0]!;
    expect(to).toBe('ops@wathba.sa');
    expect(content.subject).toBe(TEMPLATE_CATALOG_BY_KEY.pledgeReceipt.sample.subject);
  });

  it('sends the OVERRIDE (rendered) when one exists', async () => {
    const { reg, prisma, email } = buildHarness();
    prisma.emailTemplateOverride.findUnique.mockResolvedValue({
      key: 'pledgeReceipt', subjectAr: 'إيصالك المخصص', bodyAr: '<p>شكراً</p>',
    });
    await reg.execute('comms.template.test-send', { key: 'pledgeReceipt', to: 'ops@wathba.sa' }, ctx());
    const [, content] = emailMock(email).deliver.mock.calls[0]!;
    expect(content.subject).toBe('إيصالك المخصص');
    expect(content.html).toContain('شكراً');
  });

  it('rejects a malformed recipient address (email input guard)', async () => {
    const { reg, email } = buildHarness();
    await expect(
      reg.execute('comms.template.test-send', { key: 'welcome', to: 'not-an-email' }, ctx()),
    ).rejects.toBeDefined();
    expect(emailMock(email).deliver).not.toHaveBeenCalled();
  });
});
