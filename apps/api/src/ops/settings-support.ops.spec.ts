import { OperationsRegistry } from './operations.registry';
import { settingsOps } from './operations/settings.ops';
import { supportOps } from './operations/support.ops';
import { SETTINGS_CATALOG } from '../settings/settings.catalog';

import type { OperationContext } from './operation.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';
import type { EmailService } from '../email/email.service';

/**
 * Batch OPS (registry completion) — SETTINGS + SUPPORT groups:
 *  · settings.update refuses catalog-schema violations + no-op writes,
 *    upserts with the acting operator, and invalidates the read cache
 *  · support.ticket.assign refuses non-operators and starts work on an
 *    OPEN ticket as a side effect
 *  · support.ticket.status.set stamps/clears resolvedAt in both directions
 *  · support.ticket.note.add records the acting operator, never emails
 *  · support.ticket.reply notes the reply transactionally, then emails the
 *    ticket owner after commit; CLOSED tickets refuse assignment and reply
 */

type Mock = jest.Mock;
interface MockModel {
  findUnique: Mock; findUniqueOrThrow: Mock; findFirst: Mock; findFirstOrThrow: Mock;
  findMany: Mock; count: Mock; create: Mock; update: Mock; updateMany: Mock;
  delete: Mock; deleteMany: Mock; upsert: Mock;
}
interface MockDb {
  platformSetting: MockModel; supportTicket: MockModel; supportTicketNote: MockModel;
  user: MockModel; opsRoleGrant: MockModel;
  operationExecution: MockModel; auditLog: MockModel; operationProposal: MockModel;
  $transaction: Mock;
}

function buildPrisma(): MockDb {
  const model = (): MockModel => ({
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'row-1', ...data })),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  });
  const prisma: MockDb = {
    platformSetting: model(), supportTicket: model(), supportTicketNote: model(),
    user: model(), opsRoleGrant: model(),
    operationExecution: model(), auditLog: model(), operationProposal: model(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const asPrisma = (db: MockDb): PrismaService => db as unknown as PrismaService;

const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const TICKET_ID = '11111111-1111-4111-8111-111111111111';
const ASSIGNEE_ID = '22222222-2222-4222-8222-222222222222';

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
  const settings = { invalidate: jest.fn(), get: jest.fn() } as unknown as SettingsService;
  const email = { supportReply: jest.fn().mockResolvedValue({}) } as unknown as EmailService;
  for (const op of settingsOps({ settings })) reg.register(op);
  for (const op of supportOps({ prisma: asPrisma(prisma), email })) reg.register(op);
  return { prisma, reg, settings, email };
}

describe('settings.update', () => {
  it('refuses a value that fails the catalog schema (invalid-value, zod issue surfaced)', async () => {
    const { reg, prisma } = buildHarness();
    prisma.platformSetting.findUnique.mockResolvedValue(null);
    await expect(
      reg.execute('settings.update', { key: 'pledges.minHalalas', value: -5 }, ctx()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'invalid-value',
        reasonAr: expect.stringContaining('لا تطابق مخطط الإعداد'),
      }),
    });
    expect(prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('refuses writing the value already in effect (no-change against the default)', async () => {
    const { reg, prisma } = buildHarness();
    prisma.platformSetting.findUnique.mockResolvedValue(null); // default in effect
    await expect(
      reg.execute(
        'settings.update',
        { key: 'pledges.minHalalas', value: SETTINGS_CATALOG['pledges.minHalalas'].defaultValue },
        ctx(),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'no-change' }) });
  });

  it('dryRun labels the effective current value with its source (default vs db)', async () => {
    const { reg, prisma } = buildHarness();
    prisma.platformSetting.findUnique.mockResolvedValue(null);
    const dryDefault = await reg.dryRun(
      'settings.update',
      { key: 'pledges.maxHalalas', value: 500_000 },
      ctx(),
    );
    expect(dryDefault.ok).toBe(true);
    expect(dryDefault.preview!.before).toMatchObject({ value: null, source: 'default' });
    expect(dryDefault.preview!.after).toMatchObject({ value: 500_000 });

    prisma.platformSetting.findUnique.mockResolvedValue({
      key: 'pledges.maxHalalas', value: 250_000,
    });
    const dryDb = await reg.dryRun(
      'settings.update',
      { key: 'pledges.maxHalalas', value: 500_000 },
      ctx(),
    );
    expect(dryDb.preview!.before).toMatchObject({ value: 250_000, source: 'db' });
    // dryRun purity — nothing written.
    expect(prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('upserts the row with the acting operator and invalidates the read cache', async () => {
    const { reg, prisma, settings } = buildHarness();
    prisma.platformSetting.findUnique.mockResolvedValue(null);
    const out = await reg.execute(
      'settings.update',
      { key: 'pledges.minHalalas', value: 2500 },
      ctx(),
    );
    expect(out.result).toEqual({ key: 'pledges.minHalalas', value: 2500 });
    expect(prisma.platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'pledges.minHalalas' },
      create: { key: 'pledges.minHalalas', value: 2500, updatedById: ADMIN_ID },
      update: { value: 2500, updatedById: ADMIN_ID },
    });
    await flush();
    expect(settings.invalidate).toHaveBeenCalled();
  });
});

describe('support.ticket.assign', () => {
  const input = { ticketId: TICKET_ID, assigneeId: ASSIGNEE_ID };

  it('refuses an assignee who holds no ops role (assignee-not-operator)', async () => {
    const { reg, prisma } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: TICKET_ID, status: 'OPEN' });
    prisma.user.findUnique.mockResolvedValue({ id: ASSIGNEE_ID });
    prisma.opsRoleGrant.findFirst.mockResolvedValue(null);
    await expect(reg.execute('support.ticket.assign', input, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'assignee-not-operator' }),
    });
  });

  it('refuses assigning a CLOSED ticket', async () => {
    const { reg, prisma } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: TICKET_ID, status: 'CLOSED' });
    await expect(reg.execute('support.ticket.assign', input, ctx())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ticket-closed' }),
    });
  });

  it('assigns and flips OPEN → IN_PROGRESS as a side effect', async () => {
    const { reg, prisma } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: TICKET_ID, status: 'OPEN' });
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ status: 'OPEN' });
    prisma.supportTicket.update.mockResolvedValue({ status: 'IN_PROGRESS' });
    prisma.user.findUnique.mockResolvedValue({ id: ASSIGNEE_ID });
    prisma.opsRoleGrant.findFirst.mockResolvedValue({ id: 'grant-1' });
    const out = await reg.execute('support.ticket.assign', input, ctx());
    expect(out.result).toMatchObject({ assignedToId: ASSIGNEE_ID, status: 'IN_PROGRESS' });
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { assignedToId: ASSIGNEE_ID, status: 'IN_PROGRESS' },
    });
  });

  it('does NOT touch the status when the ticket is already IN_PROGRESS', async () => {
    const { reg, prisma } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: TICKET_ID, status: 'IN_PROGRESS' });
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ status: 'IN_PROGRESS' });
    prisma.supportTicket.update.mockResolvedValue({ status: 'IN_PROGRESS' });
    prisma.user.findUnique.mockResolvedValue({ id: ASSIGNEE_ID });
    prisma.opsRoleGrant.findFirst.mockResolvedValue({ id: 'grant-1' });
    await reg.execute('support.ticket.assign', input, ctx());
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { assignedToId: ASSIGNEE_ID },
    });
  });
});

describe('support.ticket.status.set', () => {
  it('refuses a transition to the current status (no-change)', async () => {
    const { reg, prisma } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: TICKET_ID, status: 'OPEN' });
    await expect(
      reg.execute('support.ticket.status.set', { ticketId: TICKET_ID, status: 'OPEN' }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'no-change' }) });
  });

  it('stamps resolvedAt when moving INTO RESOLVED', async () => {
    const { reg, prisma } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: TICKET_ID, status: 'IN_PROGRESS' });
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue({
      status: 'IN_PROGRESS', resolvedAt: null,
    });
    prisma.supportTicket.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: TICKET_ID, ...data }));
    await reg.execute(
      'support.ticket.status.set',
      { ticketId: TICKET_ID, status: 'RESOLVED' },
      ctx(),
    );
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { status: 'RESOLVED', resolvedAt: expect.any(Date) },
    });
  });

  it('clears resolvedAt when reopening', async () => {
    const { reg, prisma } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: TICKET_ID, status: 'RESOLVED' });
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue({
      status: 'RESOLVED', resolvedAt: new Date('2026-07-01T00:00:00Z'),
    });
    prisma.supportTicket.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: TICKET_ID, ...data }));
    await reg.execute(
      'support.ticket.status.set',
      { ticketId: TICKET_ID, status: 'OPEN' },
      ctx(),
    );
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { status: 'OPEN', resolvedAt: null },
    });
  });
});

describe('support.ticket.note.add', () => {
  it('creates an internal note authored by the acting operator (never emailed)', async () => {
    const { reg, prisma, email } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: TICKET_ID, topic: 'billing' });
    const out = await reg.execute(
      'support.ticket.note.add',
      { ticketId: TICKET_ID, noteAr: 'ملاحظة داخلية للفريق' },
      ctx(),
    );
    expect(out.result).toEqual({ noteId: 'row-1' });
    expect(prisma.supportTicketNote.create).toHaveBeenCalledWith({
      data: { ticketId: TICKET_ID, authorId: ADMIN_ID, noteAr: 'ملاحظة داخلية للفريق' },
    });
    await flush();
    expect((email as unknown as { supportReply: Mock }).supportReply).not.toHaveBeenCalled();
  });
});

describe('support.ticket.reply', () => {
  const ticket = {
    id: TICKET_ID, status: 'OPEN',
    name: 'سارة', email: 'sara@example.sa', topic: 'billing',
  };

  it('refuses replying to a CLOSED ticket', async () => {
    const { reg, prisma } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue({ ...ticket, status: 'CLOSED' });
    await expect(
      reg.execute('support.ticket.reply', { ticketId: TICKET_ID, replyAr: 'ردّ تجريبي' }, ctx()),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ticket-closed' }) });
  });

  it('notes the reply, flips OPEN → IN_PROGRESS, then emails the ticket owner after commit', async () => {
    const { reg, prisma, email } = buildHarness();
    prisma.supportTicket.findUnique.mockResolvedValue(ticket);
    prisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ status: 'OPEN' });
    prisma.supportTicket.update.mockResolvedValue({ status: 'IN_PROGRESS' });
    const out = await reg.execute(
      'support.ticket.reply',
      { ticketId: TICKET_ID, replyAr: 'شكراً لتواصلك — عالجنا المشكلة.' },
      ctx(),
    );
    expect(out.result).toMatchObject({ noteId: 'row-1', status: 'IN_PROGRESS' });
    // The reply is part of the ticket thread, tagged as an OUTBOUND reply.
    expect(prisma.supportTicketNote.create).toHaveBeenCalledWith({
      data: {
        ticketId: TICKET_ID,
        authorId: ADMIN_ID,
        noteAr: '«ردّ مُرسَل»: شكراً لتواصلك — عالجنا المشكلة.',
      },
    });
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { status: 'IN_PROGRESS' },
    });
    await flush();
    expect((email as unknown as { supportReply: Mock }).supportReply).toHaveBeenCalledWith(
      'sara@example.sa',
      { name: 'سارة', topic: 'billing', replyAr: 'شكراً لتواصلك — عالجنا المشكلة.' },
    );
  });
});
