import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

/**
 * OPS Part 0 — the operation contract. Every governed capability on the
 * platform is declared ONCE as an Operation and invoked only through the
 * registry; the ops UI is one client of this layer, a future agent is
 * another. Money and state machines never move through raw field edits —
 * an operation moves them, with preconditions, a mandatory dryRun and a
 * transaction-coupled audit entry (no audit = no commit).
 */

export type RiskTier = 'CONTENT' | 'STANDARD' | 'SENSITIVE' | 'MONEY';
export type ActorType = 'HUMAN' | 'AGENT' | 'SYSTEM';

export interface OperationActor {
  id: string;
  type: ActorType;
  /** Legacy coarse UserRole[] (ADMIN = "may enter the admin surfaces"). */
  roles: string[];
  /**
   * Part 2 — the resolved RBAC permission keys (union of the actor's
   * OpsRoleGrant rows; '*' = OWNER). When present the PermissionPort checks
   * ONLY this list; when absent (an unwired legacy caller) an ADMIN falls
   * back to allow-all with a loud warning until Part 5 retires the seams.
   */
  permissions?: string[];
}

export interface OperationContext {
  actor: OperationActor;
  /** Written justification; forced ≥10 chars for MONEY + SENSITIVE tiers. */
  reason?: string;
  /** Mandatory for MONEY; unique per intent — replay returns the stored result. */
  idempotencyKey?: string;
  /** Part 1 — the ops session's last password/TOTP re-entry. MONEY requires
   *  it fresh (≤10 min) on EVERY surface; SENSITIVE requires it on the ops
   *  surface (legacy admin seams warn until Part 5 retires them). */
  stepUpVerifiedAt?: Date | null;
  /** 'ops' = the hardened /v1/ops surface (ops session); 'legacy' = the old
   *  admin seams kept for the pre-ops admin screen + e2e. */
  surface?: 'ops' | 'legacy';
  ip?: string;
  userAgent?: string;
}

/** Structured preview of what WOULD change — never mutates. */
export interface DryRunPreview {
  summaryAr: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  counts?: Record<string, number>;
  /** BigInt halalas serialized as strings. */
  monetaryDeltasHalalas?: Record<string, string>;
}

export interface PreconditionDef<I> {
  code: string;
  /** Arabic refusal shown to the operator/agent when the check fails. */
  reasonAr: string;
  check: (db: ReadOnlyDb, input: I, ctx: OperationContext) => Promise<boolean>;
}

/** Read surface handed to dryRun/preconditions — writes are proxied away. */
export type ReadOnlyDb = Prisma.TransactionClient;

export interface OperationDef<I = unknown, R = unknown> {
  key: string;
  titleAr: string;
  descriptionAr: string;
  inputSchema: z.ZodType<I>;
  /** Permission key (Part 2 RBAC); the default port maps ADMIN → everything. */
  permission: string;
  riskTier: RiskTier;
  reversible: boolean;
  compensatingKey?: string;
  /** Registry forces this true for MONEY + SENSITIVE regardless. */
  requiresReason: boolean;
  /**
   * Orchestrated ops call external systems (PSP) and manage their own inner
   * transactionality; the registry claims idempotency + writes the audit row
   * atomically BEFORE invoking, then marks the claim COMPLETED/FAILED.
   * Non-orchestrated ops mutate ONLY through the tx the registry opens —
   * mutation, audit entry and idempotency row commit or roll back together.
   */
  orchestrated?: boolean;
  preconditions: Array<PreconditionDef<I>>;
  dryRun(db: ReadOnlyDb, input: I, ctx: OperationContext): Promise<DryRunPreview>;
  execute(tx: Prisma.TransactionClient, input: I, ctx: OperationContext): Promise<R>;
  /** Post-commit side effects (emails, notifications) — fire-and-forget. */
  afterCommit?(result: R, input: I, ctx: OperationContext): Promise<void>;
  /**
   * Part 2 — what gets PERSISTED as OperationExecution.result. The caller
   * still receives the full result; ops that return sensitive values
   * (users.pii.unmask) redact them here so the execution ledger never
   * stores raw PII. Absent = store the result as-is.
   */
  redactResult?(result: R): unknown;
}

export interface ExecuteOutcome<R = unknown> {
  /** Null when the call was queued for four-eyes approval instead. */
  executionId: string | null;
  replayed: boolean;
  result: R | null;
  /** Part 2 — four-eyes: true means NOTHING executed; a proposal was filed. */
  queued?: boolean;
  proposalId?: string;
}

export interface DryRunOutcome {
  ok: boolean;
  blockers: Array<{ code: string; reasonAr: string }>;
  preview: DryRunPreview | null;
}

/** Manifest row — doubles as the future agent tool manifest (Part 4). */
export interface OperationDescriptor {
  key: string;
  titleAr: string;
  descriptionAr: string;
  permission: string;
  riskTier: RiskTier;
  reversible: boolean;
  compensatingKey: string | null;
  requiresReason: boolean;
  inputSchema: Record<string, unknown>;
}

/* ── enforcement ports — implementations arrive with Parts 1/2/4 ─────── */

export interface PermissionPort {
  has(actor: OperationActor, permission: string): boolean;
}

export interface StepUpPort {
  /** Throws (Arabic) when a MONEY/SENSITIVE op lacks fresh re-auth. */
  assertFresh(ctx: OperationContext, tier: RiskTier): void;
}

export interface FourEyesPort {
  /** True → the op must enter the approval queue instead of executing. */
  mustQueue(tier: RiskTier, ctx: OperationContext): Promise<boolean>;
}
