import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * OPS Part 0 — governance lint, enforced as a failing test:
 *
 *  RULE 1 — no governed controller may touch Prisma. Every mutation flows
 *  through the operations registry; controllers are thin adapters.
 *
 *  RULE 2 — operation definitions never import a live Prisma client: they
 *  receive the transaction from the registry (type-only imports allowed).
 *
 *  RULE 3 — AdminService is read-only: no create/update/delete/upsert calls.
 *
 *  RULE 4 — inside src/ops, only the registry itself may inject
 *  PrismaService.
 */

const SRC = join(__dirname, '..');

const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

const GOVERNED_CONTROLLERS = [
  'admin/admin.controller.ts',
  'milestones/milestones.controller.ts',
  'collections/collections-admin.controller.ts',
  'home/home.controller.ts',
  'ops/ops.controller.ts',
];

describe('OPS governance — the registry is the only mutation path', () => {
  it('RULE 1: governed controllers never reference PrismaService or this.prisma', () => {
    for (const rel of GOVERNED_CONTROLLERS) {
      const src = read(rel);
      expect({ file: rel, hit: /PrismaService/.test(src) }).toEqual({ file: rel, hit: false });
      expect({ file: rel, hit: /this\.prisma\./.test(src) }).toEqual({ file: rel, hit: false });
    }
  });

  it('RULE 2: operation definitions only take Prisma as types, never as values', () => {
    const dir = join(SRC, 'ops', 'operations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      const valueImports = src
        .split('\n')
        .filter((l) => l.includes("from '../../prisma/prisma.service'"))
        .filter((l) => !l.trimStart().startsWith('import type'));
      expect({ file: f, valueImports }).toEqual({ file: f, valueImports: [] });
      expect({ file: f, hit: /new PrismaClient/.test(src) }).toEqual({ file: f, hit: false });
    }
  });

  it('RULE 3: AdminService is read-only (no mutating Prisma calls)', () => {
    const src = read('admin/admin.service.ts');
    const mutations = src.match(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g) ?? [];
    expect(mutations).toEqual([]);
  });

  it('RULE 4: within src/ops, only the registry injects PrismaService', () => {
    const dir = join(SRC, 'ops');
    const offenders: string[] = [];
    const walk = (d: string): void => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.spec.ts') &&
          entry.name !== 'operations.registry.ts' &&
          entry.name !== 'ops.module.ts' &&
          // Part 1 — the ops-session/TOTP service owns its OWN auth tables
          // (OpsSession/OpsCredential), never a governed business entity.
          entry.name !== 'ops-auth.service.ts'
        ) {
          const src = readFileSync(p, 'utf8');
          const valueImport = src
            .split('\n')
            .some(
              (l) =>
                l.includes("prisma/prisma.service'") && !l.trimStart().startsWith('import type'),
            );
          if (valueImport) offenders.push(entry.name);
        }
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });
});
