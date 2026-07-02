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
