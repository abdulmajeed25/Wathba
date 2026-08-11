# Prisma migrations

Until commit `c38dfe8` / Tier 1.2 of the audit fix plan, this repo was running
`prisma db push` to sync the schema. That's safe for local dev but a data-loss
trap in prod: a renamed column drops + recreates, NOT NULL flips fail mid-flight,
and there's no rollback history.

## Conventions

- `0001_init/migration.sql` is a baseline — generated with
  `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
  It captures the schema state at the moment migrations were introduced.
- The baseline was marked **applied** on the existing dev DB via
  `prisma migrate resolve --applied 0001_init`. New environments will run it
  fresh.
- Every subsequent schema change creates a numbered migration via
  `pnpm prisma:migrate -- --name <kebab-case-purpose>` (this runs
  `prisma migrate dev`, which generates the migration AND applies it locally).

## Workflow

| Where | Command |
|---|---|
| Local dev (schema change) | `pnpm prisma:migrate -- --name <name>` |
| Local reset (destructive) | `pnpm prisma:reset` |
| CI / production deploy | `pnpm prisma:deploy` (runs `migrate deploy` — applies pending migrations only, never generates) |

## The `searchVector` sidecar — GONE, and do not bring it back

`searchVector` is a Postgres `GENERATED ALWAYS AS … STORED` tsvector column on
`Project`. It used to be maintained in `prisma/_raw/searchVector.sql` and
applied by hand after every migration that touched `Project`.

**Migration `0062_arabic_search` moved it into the chain and the sidecar file is
deleted.** `prisma migrate deploy` is now the whole story: nothing to re-apply,
nothing to remember.

This is not tidying. The instruction that used to live here **silently broke
Arabic search**, and it did so as recently as this section being rewritten. The
sidecar defined the column with `wathba_strip_arabic_diacritics`, which strips
harakat and nothing else. 0062 redefines it with `wathba_normalize_arabic`,
which also folds hamza, ta-marbuta, alef-maksura and Arabic-Indic digits, and
keeps the old name as a thin wrapper so callers do not break. Re-applying the
sidecar afterwards `DROP FUNCTION … CASCADE`s that wrapper and rebuilds the
column on the old implementation.

Nothing errors. Search keeps working. It just stops folding — «الاحياء» stops
finding «الأحياء», «200» stops finding «٢٠٠» — and the only symptom is fewer
results than there should be. A database in that state was found by running the
e2e suite against a genuinely isolated database for the first time; the tokens
were sitting in the tsvector un-normalised while the query side normalised.

If you are looking at an old runbook that still says to apply it: that runbook
is wrong, and following it will cost you the thing 0062 was written to fix.
