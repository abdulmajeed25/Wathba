import { PrismaClient } from '@prisma/client';

/**
 * OPS Part 3 — the proving tests, run against the REAL database (the spec
 * demands enforcement "at the DB level — prove it with a test that attempts
 * an update and fails"; a mock cannot prove a trigger):
 *  · INSERT is chained by the trigger: chainSeq monotonic, prevHash links,
 *    hash recomputes via the same SQL function
 *  · UPDATE / DELETE / TRUNCATE raise 'AuditLog is append-only'
 *  · the verifier walks the whole chain and reports intact
 *
 * DATABASE_URL comes from apps/api/.env (same DB the dev server uses).
 */

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('AuditLog — hash chain (DB-enforced)', () => {
  it('chains consecutive inserts: prevHash links and the SQL hash recomputes', async () => {
    const a = await prisma.auditLog.create({
      data: { action: 'test.chain.a', entity: 'Test', entityId: 'chain-a', actorType: 'SYSTEM' },
    });
    const b = await prisma.auditLog.create({
      data: { action: 'test.chain.b', entity: 'Test', entityId: 'chain-b', actorType: 'SYSTEM' },
    });
    expect(b.chainSeq).toBe(a.chainSeq + 1n);
    expect(b.prevHash).toBe(a.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);

    // The stored hash equals a recomputation with the SAME SQL function.
    const rows = await prisma.$queryRaw<Array<{ recomputed: string }>>`
      SELECT audit_row_hash("prevHash", id, "actorId", "actorType", action, entity,
                            "entityId", reason, "inputHash", ip, "userAgent",
                            detail, "createdAt", "chainSeq") AS recomputed
      FROM "AuditLog" WHERE id = ${b.id}::uuid`;
    expect(rows[0]!.recomputed).toBe(b.hash);
  });

  it('UPDATE is rejected by the database itself', async () => {
    const row = await prisma.auditLog.create({
      data: { action: 'test.immutable.update', entity: 'Test', actorType: 'SYSTEM' },
    });
    await expect(
      prisma.$executeRaw`UPDATE "AuditLog" SET action = 'tampered' WHERE id = ${row.id}::uuid`,
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.auditLog.update({ where: { id: row.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow();
  });

  it('DELETE is rejected by the database itself', async () => {
    const row = await prisma.auditLog.create({
      data: { action: 'test.immutable.delete', entity: 'Test', actorType: 'SYSTEM' },
    });
    await expect(
      prisma.$executeRaw`DELETE FROM "AuditLog" WHERE id = ${row.id}::uuid`,
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
  });

  it('TRUNCATE is rejected by the database itself', async () => {
    await expect(prisma.$executeRawUnsafe('TRUNCATE "AuditLog"')).rejects.toThrow(/append-only/);
  });

  it('the verifier walks the WHOLE chain and reports it intact', async () => {
    const verdicts = await prisma.$queryRaw<
      Array<{ total: bigint; brokenAt: bigint | null }>
    >`
      WITH ordered AS (
        SELECT *, lag("hash", 1, 'GENESIS') OVER (ORDER BY "chainSeq") AS expected_prev
        FROM "AuditLog"
      )
      SELECT count(*)::bigint AS total,
             min("chainSeq") FILTER (
               WHERE "prevHash" IS DISTINCT FROM expected_prev
                  OR "hash" IS DISTINCT FROM audit_row_hash(
                       "prevHash", id, "actorId", "actorType", action, entity,
                       "entityId", reason, "inputHash", ip, "userAgent",
                       detail, "createdAt", "chainSeq")
             ) AS "brokenAt"
      FROM ordered`;
    expect(Number(verdicts[0]!.total)).toBeGreaterThan(0);
    expect(verdicts[0]!.brokenAt).toBeNull();
  });

  it('concurrent inserts never fork the chain (advisory lock serializes)', async () => {
    const rows = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        prisma.auditLog.create({
          data: { action: `test.concurrent.${i}`, entity: 'Test', actorType: 'SYSTEM' },
        }),
      ),
    );
    const seqs = rows.map((r) => r.chainSeq).sort((x, y) => (x < y ? -1 : 1));
    // Strictly consecutive — no gaps, no duplicates, no crossed links.
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]! - seqs[i - 1]!).toBe(1n);
    const byId = new Map(rows.map((r) => [r.chainSeq, r]));
    for (let i = 1; i < seqs.length; i++) {
      expect(byId.get(seqs[i]!)!.prevHash).toBe(byId.get(seqs[i - 1]!)!.hash);
    }
  });
});
