import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { PrismaService } from '../prisma/prisma.service';
import type {
  DryRunOutcome,
  ExecuteOutcome,
  FourEyesPort,
  OperationContext,
  OperationDef,
  OperationDescriptor,
  PermissionPort,
  ReadOnlyDb,
  StepUpPort,
} from './operation.types';

/**
 * OPS Part 0 — THE registry. Everything else (admin routes today, the ops
 * UI in Part 5, agents in Part 4) is a client of list/describe/dryRun/
 * execute. No admin route may mutate the database except through here —
 * enforced by the governance spec (ops-governance.spec.ts).
 *
 * Enforcement ports ship with fail-safe defaults and are replaced as the
 * later parts land: PermissionPort (coarse ADMIN → Part 2 RBAC), StepUpPort
 * (env-gated OPS_STEPUP_ENFORCED → Part 1 guard), FourEyesPort (off →
 * Part 2 approval queue). One rule is NOT deferred: an AGENT actor can
 * never execute a MONEY operation — refused here before permissions are
 * even consulted, regardless of role.
 */

const WRITE_METHODS = new Set([
  'create', 'createMany', 'createManyAndReturn',
  'update', 'updateMany', 'updateManyAndReturn',
  'upsert', 'delete', 'deleteMany',
  '$executeRaw', '$executeRawUnsafe', '$transaction',
  '$queryRawUnsafe',
]);

/** Wraps a Prisma client so any write attempt throws — dryRun purity is a
 *  runtime guarantee, not a convention. */
export function readOnlyDb(prisma: PrismaService): ReadOnlyDb {
  const wrapModel = (model: object): object =>
    new Proxy(model, {
      get(target, prop: string) {
        if (WRITE_METHODS.has(prop)) {
          throw new Error(`dryRun purity violation: ${prop}() is a write`);
        }
        return (target as Record<string, unknown>)[prop];
      },
    });
  return new Proxy(prisma, {
    get(target, prop: string) {
      if (WRITE_METHODS.has(prop)) {
        throw new Error(`dryRun purity violation: ${prop}() is a write`);
      }
      const value = (target as unknown as Record<string, unknown>)[prop];
      if (
        value && typeof value === 'object' && !prop.startsWith('$') &&
        'findMany' in (value as object)
      ) {
        return wrapModel(value as object);
      }
      return value;
    },
  }) as unknown as ReadOnlyDb;
}

/** Canonical (sorted-keys) JSON → sha256; BigInt-safe. */
export function inputHashOf(input: unknown): string {
  const canonical = JSON.stringify(input, (_k, v: unknown) => {
    if (typeof v === 'bigint') return v.toString();
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return v;
  });
  return createHash('sha256').update(canonical).digest('hex');
}

const defaultPermissionPort: PermissionPort = {
  // Part 2 replaces this with the RBAC matrix; until then ADMIN = everything.
  has: (actor, _permission) => actor.roles.includes('ADMIN'),
};

const STEP_UP_WINDOW_MS = 10 * 60_000;
const stepUpLogger = new Logger('StepUpPort');
const defaultStepUpPort: StepUpPort = {
  // Part 1 — ENFORCED. MONEY demands a fresh re-auth on every surface (the
  // ops session's stepUpAt, carried in ctx). SENSITIVE demands it on the ops
  // surface; the legacy admin seams (pre-ops admin screen + e2e) warn loudly
  // until Part 5 retires that screen — money never got the grace period.
  assertFresh(ctx, tier) {
    if (tier !== 'MONEY' && tier !== 'SENSITIVE') return;
    const at = ctx.stepUpVerifiedAt?.getTime() ?? 0;
    if (Date.now() - at <= STEP_UP_WINDOW_MS) return;
    if (tier === 'SENSITIVE' && ctx.surface !== 'ops') {
      stepUpLogger.warn(
        `SENSITIVE operation without step-up on the legacy surface (actor=${ctx.actor.id}) — ` +
          'tolerated until Part 5 retires the old admin screen; the /v1/ops surface already enforces',
      );
      return;
    }
    throw new ForbiddenException(
      'هذه العملية تتطلب إعادة توثيق حديثة (خلال ١٠ دقائق) — ادخل مركز العمليات وأعد إدخال كلمة المرور',
    );
  },
};

const defaultFourEyesPort: FourEyesPort = {
  // Replaced at boot by OpsRbacService (Part 2): auto-on at the 2nd money
  // admin, config-on before that. Default stays fail-open only for unit
  // tests that construct the registry bare.
  mustQueue: async () => false,
};

@Injectable()
export class OperationsRegistry {
  private readonly logger = new Logger(OperationsRegistry.name);
  private readonly ops = new Map<string, OperationDef<unknown, unknown>>();

  permissionPort: PermissionPort = defaultPermissionPort;
  stepUpPort: StepUpPort = defaultStepUpPort;
  fourEyesPort: FourEyesPort = defaultFourEyesPort;

  constructor(private readonly prisma: PrismaService) {}

  register<I, R>(op: OperationDef<I, R>): void {
    if (this.ops.has(op.key)) {
      throw new Error(`operation key registered twice: ${op.key}`);
    }
    this.ops.set(op.key, op as OperationDef<unknown, unknown>);
  }

  list(): OperationDescriptor[] {
    return [...this.ops.values()]
      .map((op) => this.describeOp(op))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  describe(key: string): OperationDescriptor {
    return this.describeOp(this.mustGet(key));
  }

  async dryRun(key: string, rawInput: unknown, ctx: OperationContext): Promise<DryRunOutcome> {
    const op = this.mustGet(key);
    this.assertPermission(op, ctx);
    const input = this.parseInput(op, rawInput);
    const db = readOnlyDb(this.prisma);
    const blockers: Array<{ code: string; reasonAr: string }> = [];
    for (const pre of op.preconditions) {
      if (!(await pre.check(db, input, ctx))) {
        blockers.push({ code: pre.code, reasonAr: pre.reasonAr });
      }
    }
    if (blockers.length > 0) return { ok: false, blockers, preview: null };
    return { ok: true, blockers: [], preview: await op.dryRun(db, input, ctx) };
  }

  async execute<R = unknown>(
    key: string,
    rawInput: unknown,
    ctx: OperationContext,
  ): Promise<ExecuteOutcome<R>> {
    const op = this.mustGet(key);

    // HARD RULE (Part 4, enforced from day 0): agents never execute money —
    // checked before roles/permissions so no configuration can allow it.
    if (ctx.actor.type === 'AGENT' && op.riskTier === 'MONEY') {
      throw new ForbiddenException(
        'وكلاء الذكاء الاصطناعي لا يُنفّذون عمليات مالية أبداً — المسموح: dryRun واقتراح للطابور',
      );
    }

    this.assertPermission(op, ctx);
    const input = this.parseInput(op, rawInput);

    const needsReason =
      op.requiresReason || op.riskTier === 'MONEY' || op.riskTier === 'SENSITIVE';
    if (needsReason && (ctx.reason?.trim().length ?? 0) < 10) {
      throw new BadRequestException(
        'هذه العملية تتطلب سبباً مكتوباً (١٠ أحرف على الأقل) يُسجَّل في سجل التدقيق',
      );
    }

    if (op.riskTier === 'MONEY' && !ctx.idempotencyKey) {
      throw new BadRequestException('العمليات المالية تتطلب idempotencyKey');
    }

    this.stepUpPort.assertFresh(ctx, op.riskTier);

    const inputHash = inputHashOf(input);
    const idemKey = ctx.idempotencyKey;
    if (idemKey) {
      const prior = await this.prisma.operationExecution.findUnique({
        where: { idempotencyKey: idemKey },
      });
      if (prior) {
        if (prior.inputHash !== inputHash || prior.operationKey !== op.key) {
          throw new ConflictException('idempotencyKey مستخدم سابقاً بمدخلات مختلفة');
        }
        if (prior.status === 'COMPLETED') {
          return { executionId: prior.id, replayed: true, result: prior.result as R };
        }
        throw new ConflictException(`تنفيذ سابق بالحالة ${prior.status} — لا يُعاد تلقائياً`);
      }
    }

    // Preconditions (read-only pass; re-evaluated transactionally below for
    // non-orchestrated ops via the same checks against the tx client).
    const roDb = readOnlyDb(this.prisma);
    for (const pre of op.preconditions) {
      if (!(await pre.check(roDb, input, ctx))) {
        throw new UnprocessableEntityException({ code: pre.code, reasonAr: pre.reasonAr });
      }
    }

    // Part 2 — four-eyes: when the switch is in effect, a MONEY execute
    // files a PROPOSAL (with the dryRun snapshot the proposer saw) instead
    // of executing. A DIFFERENT user with money.approve executes it later
    // through executeProposal(); self-approval is refused there.
    if (op.riskTier === 'MONEY' && (await this.fourEyesPort.mustQueue(op.riskTier, ctx))) {
      return this.queueProposal<R>(op, input, ctx, inputHash);
    }

    const outcome = op.orchestrated
      ? await this.executeOrchestrated<R>(op, input, ctx, inputHash)
      : await this.executeTransactional<R>(op, input, ctx, inputHash);

    if (op.afterCommit) {
      op.afterCommit(outcome.result, input, ctx).catch((err) =>
        this.logger.warn(`afterCommit(${op.key}) failed: ${String(err)}`),
      );
    }
    return outcome;
  }

  /** Mutation + audit + idempotency row: one transaction, or nothing. */
  private async executeTransactional<R>(
    op: OperationDef<unknown, unknown>,
    input: unknown,
    ctx: OperationContext,
    inputHash: string,
  ): Promise<ExecuteOutcome<R>> {
    return this.prisma.$transaction(async (tx) => {
      // Re-check inside the tx: the read-only pass above closes UX latency,
      // this one closes the race.
      for (const pre of op.preconditions) {
        if (!(await pre.check(tx, input, ctx))) {
          throw new UnprocessableEntityException({ code: pre.code, reasonAr: pre.reasonAr });
        }
      }
      const result = await op.execute(tx, input, ctx);
      const stored = op.redactResult ? op.redactResult(result) : result;
      const execution = await tx.operationExecution.create({
        data: {
          idempotencyKey: ctx.idempotencyKey ?? `auto-${crypto.randomUUID()}`,
          operationKey: op.key,
          inputHash,
          actorId: ctx.actor.id,
          actorType: ctx.actor.type,
          riskTier: op.riskTier,
          reason: ctx.reason ?? null,
          status: 'COMPLETED',
          result: (stored ?? null) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      // No audit = no commit: this create is INSIDE the same transaction and
      // is not caught — an audit failure rolls the mutation back.
      await tx.auditLog.create({
        data: {
          actorId: this.uuidOrNull(ctx.actor.id),
          action: `ops.${op.key}`,
          entity: 'Operation',
          entityId: execution.id,
          detail: {
            riskTier: op.riskTier,
            actorType: ctx.actor.type,
            reason: ctx.reason ?? null,
            inputHash,
            input: JSON.parse(JSON.stringify(input, (_k, v: unknown) =>
              typeof v === 'bigint' ? v.toString() : v)) as Prisma.InputJsonValue,
            idempotencyKey: ctx.idempotencyKey ?? null,
            ip: ctx.ip ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      return { executionId: execution.id, replayed: false, result: result as R };
    });
  }

  /**
   * Orchestrated ops (PSP calls inside): claim idempotency + audit atomically
   * FIRST, then run; the claim row records the outcome. A crash mid-flight
   * leaves status=CLAIMED, which refuses silent auto-replay (money-safe).
   */
  private async executeOrchestrated<R>(
    op: OperationDef<unknown, unknown>,
    input: unknown,
    ctx: OperationContext,
    inputHash: string,
  ): Promise<ExecuteOutcome<R>> {
    const claim = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operationExecution.create({
        data: {
          idempotencyKey: ctx.idempotencyKey ?? `auto-${crypto.randomUUID()}`,
          operationKey: op.key,
          inputHash,
          actorId: ctx.actor.id,
          actorType: ctx.actor.type,
          riskTier: op.riskTier,
          reason: ctx.reason ?? null,
          status: 'CLAIMED',
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: this.uuidOrNull(ctx.actor.id),
          action: `ops.${op.key}`,
          entity: 'Operation',
          entityId: row.id,
          detail: {
            riskTier: op.riskTier,
            actorType: ctx.actor.type,
            reason: ctx.reason ?? null,
            inputHash,
            orchestrated: true,
            idempotencyKey: ctx.idempotencyKey ?? null,
            ip: ctx.ip ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      return row;
    });

    try {
      const result = await op.execute(
        this.prisma as unknown as Prisma.TransactionClient,
        input,
        ctx,
      );
      const stored = op.redactResult ? op.redactResult(result) : result;
      await this.prisma.operationExecution.update({
        where: { id: claim.id },
        data: {
          status: 'COMPLETED',
          result: (stored ?? null) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return { executionId: claim.id, replayed: false, result: result as R };
    } catch (err) {
      await this.prisma.operationExecution
        .update({ where: { id: claim.id }, data: { status: 'FAILED', completedAt: new Date() } })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Part 2 — file a four-eyes proposal instead of executing. The dryRun
   * snapshot (what the proposer saw) is attached; the proposal row and its
   * audit entry commit together. Replaying the same idempotencyKey while
   * the proposal is PENDING returns the same proposal, not a duplicate.
   */
  private async queueProposal<R>(
    op: OperationDef<unknown, unknown>,
    input: unknown,
    ctx: OperationContext,
    inputHash: string,
  ): Promise<ExecuteOutcome<R>> {
    if (ctx.idempotencyKey) {
      const prior = await this.prisma.operationProposal.findUnique({
        where: { idempotencyKey: ctx.idempotencyKey },
      });
      if (prior) {
        if (prior.inputHash !== inputHash || prior.operationKey !== op.key) {
          throw new ConflictException('idempotencyKey مستخدم سابقاً بمدخلات مختلفة');
        }
        return { executionId: null, replayed: true, result: null, queued: true, proposalId: prior.id };
      }
    }
    const preview = await op.dryRun(readOnlyDb(this.prisma), input, ctx);
    const proposal = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operationProposal.create({
        data: {
          operationKey: op.key,
          input: JSON.parse(JSON.stringify(input, (_k, v: unknown) =>
            typeof v === 'bigint' ? v.toString() : v)) as Prisma.InputJsonValue,
          inputHash,
          preview: JSON.parse(JSON.stringify(preview)) as Prisma.InputJsonValue,
          reason: ctx.reason ?? '',
          riskTier: op.riskTier,
          proposedById: ctx.actor.id,
          proposedByType: ctx.actor.type,
          idempotencyKey: ctx.idempotencyKey ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: this.uuidOrNull(ctx.actor.id),
          action: 'ops.proposal.create',
          entity: 'OperationProposal',
          entityId: row.id,
          detail: {
            operationKey: op.key,
            riskTier: op.riskTier,
            actorType: ctx.actor.type,
            reason: ctx.reason ?? null,
            inputHash,
            ip: ctx.ip ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      return row;
    });
    this.logger.log(`four-eyes: ${op.key} queued as proposal ${proposal.id} by ${ctx.actor.id}`);
    return { executionId: null, replayed: false, result: null, queued: true, proposalId: proposal.id };
  }

  /**
   * Part 2 — execute an approved proposal. The approver is the second pair
   * of eyes: a DIFFERENT user holding money.approve, with a fresh step-up
   * and a written decision reason. Preconditions re-run against the current
   * state (a stale proposal refuses cleanly); the execution carries the
   * proposer's idempotencyKey so retries replay instead of double-paying.
   */
  async executeProposal<R = unknown>(
    proposalId: string,
    ctx: OperationContext,
  ): Promise<ExecuteOutcome<R>> {
    const proposal = await this.prisma.operationProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('الاقتراح غير موجود');
    const op = this.mustGet(proposal.operationKey);

    // The same hard rule as execute(): an agent is never the second pair of
    // eyes on money — checked before any permission.
    if (ctx.actor.type === 'AGENT' && op.riskTier === 'MONEY') {
      throw new ForbiddenException(
        'وكلاء الذكاء الاصطناعي لا يُنفّذون عمليات مالية أبداً — المسموح: dryRun واقتراح للطابور',
      );
    }
    if (!this.permissionPort.has(ctx.actor, 'money.approve')) {
      throw new ForbiddenException('تفتقد الصلاحية المطلوبة: money.approve');
    }
    // Self-approval refused at the domain level — no role combination
    // allows the proposer to be their own second pair of eyes.
    if (proposal.proposedById === ctx.actor.id) {
      throw new ForbiddenException('لا يجوز اعتماد اقتراحك بنفسك — مبدأ العيون الأربع يتطلب شخصاً آخر');
    }
    if ((ctx.reason?.trim().length ?? 0) < 10) {
      throw new BadRequestException(
        'اعتماد عملية مالية يتطلب سبباً مكتوباً (١٠ أحرف على الأقل) يُسجَّل في سجل التدقيق',
      );
    }
    this.stepUpPort.assertFresh(ctx, op.riskTier);

    const input = this.parseInput(op, proposal.input);
    if (inputHashOf(input) !== proposal.inputHash) {
      throw new ConflictException('بصمة المدخلات لا تطابق الاقتراح — يُرفض التنفيذ');
    }

    // Atomic claim: two simultaneous approvers → exactly one proceeds.
    const claimed = await this.prisma.operationProposal.updateMany({
      where: { id: proposal.id, status: 'PENDING' },
      data: { status: 'EXECUTING', decidedById: this.uuidOrNull(ctx.actor.id), decidedAt: new Date(), decisionReason: ctx.reason },
    });
    if (claimed.count === 0) {
      throw new ConflictException(`الاقتراح ليس معلّقاً (الحالة: ${proposal.status}) — لا يُنفَّذ`);
    }

    const execCtx: OperationContext = {
      ...ctx,
      reason: `[اعتماد عيون-أربع للاقتراح ${proposal.id}] ${ctx.reason ?? ''} | سبب الاقتراح: ${proposal.reason}`,
      idempotencyKey: proposal.idempotencyKey ?? `proposal-${proposal.id}`,
    };
    try {
      const roDb = readOnlyDb(this.prisma);
      for (const pre of op.preconditions) {
        if (!(await pre.check(roDb, input, execCtx))) {
          throw new UnprocessableEntityException({ code: pre.code, reasonAr: pre.reasonAr });
        }
      }
      const inputHash = proposal.inputHash;
      const outcome = op.orchestrated
        ? await this.executeOrchestrated<R>(op, input, execCtx, inputHash)
        : await this.executeTransactional<R>(op, input, execCtx, inputHash);
      await this.prisma.operationProposal.update({
        where: { id: proposal.id },
        data: { status: 'EXECUTED', executionId: outcome.executionId },
      });
      if (op.afterCommit) {
        op.afterCommit(outcome.result, input, execCtx).catch((err) =>
          this.logger.warn(`afterCommit(${op.key}) failed: ${String(err)}`),
        );
      }
      return { ...outcome, proposalId: proposal.id };
    } catch (err) {
      // Terminal — a failed approval is visible and re-proposed, never
      // silently retried (money-safe).
      await this.prisma.operationProposal
        .update({
          where: { id: proposal.id },
          data: { status: 'FAILED', decisionReason: `${ctx.reason ?? ''} | فشل التنفيذ: ${String(err).slice(0, 300)}` },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  private describeOp(op: OperationDef<unknown, unknown>): OperationDescriptor {
    return {
      key: op.key,
      titleAr: op.titleAr,
      descriptionAr: op.descriptionAr,
      permission: op.permission,
      riskTier: op.riskTier,
      reversible: op.reversible,
      compensatingKey: op.compensatingKey ?? null,
      requiresReason: op.requiresReason || op.riskTier === 'MONEY' || op.riskTier === 'SENSITIVE',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: zodToJsonSchema(op.inputSchema as any, { $refStrategy: 'none' }) as Record<
        string,
        unknown
      >,
    };
  }

  private mustGet(key: string): OperationDef<unknown, unknown> {
    const op = this.ops.get(key);
    if (!op) throw new NotFoundException(`unknown operation: ${key}`);
    return op;
  }

  private assertPermission(op: OperationDef<unknown, unknown>, ctx: OperationContext): void {
    if (!this.permissionPort.has(ctx.actor, op.permission)) {
      throw new ForbiddenException(`تفتقد الصلاحية المطلوبة: ${op.permission}`);
    }
  }

  private parseInput(op: OperationDef<unknown, unknown>, raw: unknown): unknown {
    try {
      return op.inputSchema.parse(raw ?? {});
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'مدخلات غير صالحة',
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      throw err;
    }
  }

  /** AuditLog.actorId is a uuid column; system/agent ids may not be uuids. */
  private uuidOrNull(id: string): string | null {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
  }
}
