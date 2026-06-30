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

## The `searchVector` sidecar

`searchVector` is a Postgres `GENERATED ALWAYS AS … STORED` tsvector column on
`Project`. Prisma 6 does not yet model generated columns, so it's maintained in
`prisma/_raw/searchVector.sql`. Re-apply after any migration that touches the
`Project` table:

```bash
PGPASSWORD=$DB_PWD psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -f apps/api/prisma/_raw/searchVector.sql
```

The SQL is idempotent (drops + recreates), so re-applying after every deploy is
safe.
