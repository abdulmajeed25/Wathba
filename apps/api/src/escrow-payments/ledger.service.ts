import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerEntryType } from '@prisma/client';

/**
 * Append-only money journal writer (Sprint 1 / P1-602).
 *
 * `record()` never throws: a failed journal write must not fail the money
 * operation it describes — the gap is logged loudly and surfaces in
 * reconciliation instead. Rows map 1:1 to real PSP events via `pspRef`.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    entryType: LedgerEntryType;
    amountHalalas: bigint;
    pspRef: string;
    pledgeId?: string;
    payoutId?: string;
    projectId?: string;
    source?: 'sync-path' | 'webhook' | 'disburser';
  }): Promise<void> {
    try {
      await this.prisma.ledgerEntry.create({
        data: {
          entryType: entry.entryType,
          amountHalalas: entry.amountHalalas,
          pspRef: entry.pspRef,
          pledgeId: entry.pledgeId ?? null,
          payoutId: entry.payoutId ?? null,
          projectId: entry.projectId ?? null,
          source: entry.source ?? 'sync-path',
        },
      });
    } catch (err) {
      this.logger.error(
        `LEDGER WRITE FAILED type=${entry.entryType} pspRef=${entry.pspRef} amount=${entry.amountHalalas} — journal gap, reconcile manually`,
        err as Error,
      );
    }
  }

  /**
   * OPS-INTEGRITY — evidence-gated, INSERT-ONLY backfill of a MISSING journal
   * row. `record()` swallows write failures (a journal gap must not fail the
   * money move it describes), so real gaps exist; this is the operator's
   * correcting insert for one. Unlike `record()` it THROWS on failure — the
   * governed op must be marked FAILED, not silently swallow a second gap.
   *
   * The LedgerEntry has no note/evidence column and is DB-enforced append-only
   * (no UPDATE/DELETE), so the evidence trail (evidenceUrl + noteAr) does NOT
   * live on the row: it lives in the AuditLog the ops registry writes for the
   * execute (the full op input — including evidenceUrl/noteAr — is hashed and
   * stored there). `amountHalalas` may be negative for a correcting reversal.
   */
  async backfill(entry: {
    entryType: LedgerEntryType;
    amountHalalas: bigint;
    pspRef: string;
    pledgeId?: string;
    projectId?: string;
  }): Promise<{ id: string }> {
    const row = await this.prisma.ledgerEntry.create({
      data: {
        entryType: entry.entryType,
        amountHalalas: entry.amountHalalas,
        pspRef: entry.pspRef,
        pledgeId: entry.pledgeId ?? null,
        projectId: entry.projectId ?? null,
        source: 'ops-backfill',
      },
    });
    return { id: row.id };
  }

  /** Per-project ledger sums — the reconciliation primitive. */
  async projectSummary(projectId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.ledgerEntry.groupBy({
      by: ['entryType'],
      where: { projectId },
      _sum: { amountHalalas: true },
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.entryType] = (r._sum.amountHalalas ?? 0n).toString();
    }
    return out;
  }
}
