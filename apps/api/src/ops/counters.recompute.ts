import { PledgeStatus } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import type { ReadOnlyDb } from './operation.types';

/**
 * Batch OPS-PRO Phase 1 — money-derived counter recompute (money.counters.recompute).
 *
 * These project/tier/add-on counters are maintained incrementally by the
 * capture/refund/settlement paths; a mid-flight crash or a legacy backfill can
 * leave them drifting from the pledge ledger. This module recomputes each one
 * from the SINGLE authoritative formula below and reports (dryRun) or corrects
 * (execute) the drift. It reads only through the passed client, so the same
 * code runs against the dryRun read-only proxy and the live prisma client.
 *
 * Authoritative formulas (scout SoT):
 *   raisedHalalas    = Σ(amount+addOns) over the ACTIVE set
 *   realizedHalalas  = Σ(amount+addOns) where CAPTURED
 *   backersCount     = COUNT(DISTINCT backerId) over the BACKER set
 *   RewardTier.claimedQty = COUNT(pledges on the tier) over the ACTIVE set
 *   AddOn.claimedQty      = Σ(PledgeAddOn.qty) joined to pledges in the ACTIVE set
 */

/** Money-bearing "still on the platform" pledges — raised + tier/add-on stock. */
const ACTIVE_STATUSES: PledgeStatus[] = [
  PledgeStatus.HELD,
  PledgeStatus.PENDING_BNPL,
  PledgeStatus.CAPTURED,
  PledgeStatus.CAPTURE_GRACE,
  PledgeStatus.PENDING_REAUTH,
];

/** A distinct backer counts while they hold ANY confirmed-or-authorized pledge
 *  (grace/reauth are excluded — a failing capture is not yet a counted backer). */
const BACKER_STATUSES: PledgeStatus[] = [
  PledgeStatus.HELD,
  PledgeStatus.PENDING_BNPL,
  PledgeStatus.CAPTURED,
];

export interface CounterDriftRow {
  field: string;
  before: string;
  after: string;
}

/** Internal analysis row — carries the write target alongside the report. */
type AnalysisRow =
  | { kind: 'project'; projField: 'raisedHalalas' | 'realizedHalalas'; field: string; before: bigint; after: bigint }
  | { kind: 'projectCount'; projField: 'backersCount'; field: string; before: number; after: number }
  | { kind: 'tier'; id: string; field: string; before: number; after: number }
  | { kind: 'addOn'; id: string; field: string; before: number; after: number };

/** Read-only pass: compute every authoritative value and pair it with the
 *  stored one. No writes — safe under the dryRun purity proxy. */
async function analyze(db: ReadOnlyDb, projectId: string): Promise<AnalysisRow[]> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { raisedHalalas: true, realizedHalalas: true, backersCount: true },
  });
  if (!project) return [];

  const [raisedAgg, realizedAgg, backerRows, tiers, addOns, tierGroups, addOnGroups] =
    await Promise.all([
      db.pledge.aggregate({
        where: { projectId, status: { in: ACTIVE_STATUSES } },
        _sum: { amountHalalas: true, addOnsHalalas: true },
      }),
      db.pledge.aggregate({
        where: { projectId, status: PledgeStatus.CAPTURED },
        _sum: { amountHalalas: true, addOnsHalalas: true },
      }),
      db.pledge.findMany({
        where: { projectId, status: { in: BACKER_STATUSES } },
        select: { backerId: true },
        distinct: ['backerId'],
      }),
      db.rewardTier.findMany({ where: { projectId }, select: { id: true, claimedQty: true } }),
      db.addOn.findMany({ where: { projectId }, select: { id: true, claimedQty: true } }),
      db.pledge.groupBy({
        by: ['tierId'],
        where: { projectId, tierId: { not: null }, status: { in: ACTIVE_STATUSES } },
        _count: true,
      }),
      db.pledgeAddOn.groupBy({
        by: ['addOnId'],
        where: { pledge: { projectId, status: { in: ACTIVE_STATUSES } } },
        _sum: { qty: true },
      }),
    ]);

  const raised = (raisedAgg._sum.amountHalalas ?? 0n) + (raisedAgg._sum.addOnsHalalas ?? 0n);
  const realized = (realizedAgg._sum.amountHalalas ?? 0n) + (realizedAgg._sum.addOnsHalalas ?? 0n);
  const backersCount = backerRows.length;

  const tierCount = new Map<string, number>();
  for (const g of tierGroups as Array<{ tierId: string | null; _count: unknown }>) {
    if (g.tierId) tierCount.set(g.tierId, typeof g._count === 'number' ? g._count : 0);
  }
  const addOnQty = new Map<string, number>();
  for (const g of addOnGroups as Array<{ addOnId: string; _sum: { qty: number | null } }>) {
    addOnQty.set(g.addOnId, g._sum.qty ?? 0);
  }

  const rows: AnalysisRow[] = [
    { kind: 'project', projField: 'raisedHalalas', field: 'raisedHalalas', before: project.raisedHalalas, after: raised },
    { kind: 'project', projField: 'realizedHalalas', field: 'realizedHalalas', before: project.realizedHalalas, after: realized },
    { kind: 'projectCount', projField: 'backersCount', field: 'backersCount', before: project.backersCount, after: backersCount },
  ];
  for (const t of tiers) {
    rows.push({ kind: 'tier', id: t.id, field: `tier:${t.id}.claimedQty`, before: t.claimedQty, after: tierCount.get(t.id) ?? 0 });
  }
  for (const a of addOns) {
    rows.push({ kind: 'addOn', id: a.id, field: `addOn:${a.id}.claimedQty`, before: a.claimedQty, after: addOnQty.get(a.id) ?? 0 });
  }
  return rows;
}

const drifted = (r: AnalysisRow): boolean => r.before !== r.after;

const toReport = (rows: AnalysisRow[]): CounterDriftRow[] =>
  rows
    .filter(drifted)
    .map((r) => ({ field: r.field, before: r.before.toString(), after: r.after.toString() }));

/** dryRun — the valuable part: exactly what is off, WITHOUT writing. */
export async function computeCounterDrift(db: ReadOnlyDb, projectId: string): Promise<CounterDriftRow[]> {
  return toReport(await analyze(db, projectId));
}

/** execute — recompute then correct ONLY the drifted counters, in one tx. */
export async function recomputeCounters(
  prisma: PrismaService,
  projectId: string,
): Promise<CounterDriftRow[]> {
  const rows = await analyze(prisma as unknown as ReadOnlyDb, projectId);
  const drift = rows.filter(drifted);
  if (drift.length === 0) return [];

  await prisma.$transaction(async (tx) => {
    const projData: Record<string, bigint | number> = {};
    for (const r of drift) {
      if (r.kind === 'project') projData[r.projField] = r.after;
      else if (r.kind === 'projectCount') projData[r.projField] = r.after;
      else if (r.kind === 'tier')
        await tx.rewardTier.update({ where: { id: r.id }, data: { claimedQty: r.after } });
      else await tx.addOn.update({ where: { id: r.id }, data: { claimedQty: r.after } });
    }
    if (Object.keys(projData).length > 0) {
      await tx.project.update({ where: { id: projectId }, data: projData });
    }
  });

  return toReport(drift);
}
