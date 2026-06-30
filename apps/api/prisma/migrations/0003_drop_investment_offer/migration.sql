-- Tier 3.1 — Drop the dormant InvestmentOffer table.
--
-- InvestmentModule was registered but gated behind INVESTMENT_ENABLED=true
-- and never instantiated. The Prisma model existed only so the schema would
-- compile. With no controllers, no providers active, and no other context
-- referencing the table, keeping it around is dead weight + a regulatory
-- foot-gun ("DO NOT REGISTER WITHOUT A LICENSE").
--
-- The table is empty in dev (verified pre-migration). If it ever needs to
-- come back it must be paired with a Saudi securities license + a fresh
-- migration; this isn't a "revertible" change in spirit even if it is in SQL.
--
-- Does NOT touch the searchVector tsvector column / GIN indexes on Project —
-- those are managed by prisma/_raw/searchVector.sql (Prisma can't model
-- GENERATED columns). The auto-diff suggested dropping them; we override.

DROP TABLE IF EXISTS "InvestmentOffer";
