-- OPS Part 3 — the append-only, tamper-evident audit log. Hand-written.
--
-- 1. Typed audit columns (actorType, riskTier, reason, inputHash, …).
-- 2. Hash chain: hash = sha256(prevHash || canonical(entry)), computed by a
--    BEFORE INSERT trigger under an advisory tx lock (chainSeq = MAX+1, so
--    chain order IS lock order — no sequence-gap races). The SAME SQL
--    function feeds the verification query: formula parity by construction.
-- 3. Immutability at the DB level: UPDATE / DELETE / TRUNCATE raise, and the
--    app role's privileges are revoked. Proven by audit-chain.spec.ts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "AuditLog"
    ADD COLUMN "actorType" TEXT,
    ADD COLUMN "agentId" TEXT,
    ADD COLUMN "riskTier" TEXT,
    ADD COLUMN "reason" TEXT,
    ADD COLUMN "inputHash" TEXT,
    ADD COLUMN "idempotencyKey" TEXT,
    ADD COLUMN "ip" TEXT,
    ADD COLUMN "userAgent" TEXT,
    ADD COLUMN "chainSeq" BIGINT,
    ADD COLUMN "prevHash" TEXT,
    ADD COLUMN "hash" TEXT;

-- Pre-chain rows: system actions have no actor; everything else was human.
UPDATE "AuditLog" SET "actorType" = CASE WHEN "actorId" IS NULL THEN 'SYSTEM' ELSE 'HUMAN' END
WHERE "actorType" IS NULL;

-- ── The canonical hash — ONE definition for trigger, backfill and verifier ──
CREATE OR REPLACE FUNCTION audit_row_hash(
    prev TEXT, r_id UUID, r_actor UUID, r_actor_type TEXT, r_action TEXT,
    r_entity TEXT, r_entity_id TEXT, r_reason TEXT, r_input_hash TEXT,
    r_ip TEXT, r_user_agent TEXT, r_detail JSONB, r_created TIMESTAMP, r_seq BIGINT
) RETURNS TEXT AS $$
  SELECT encode(digest(
    coalesce(prev, '')            || '|' ||
    r_id::text                    || '|' ||
    coalesce(r_actor::text, '')   || '|' ||
    coalesce(r_actor_type, '')    || '|' ||
    r_action                      || '|' ||
    r_entity                      || '|' ||
    coalesce(r_entity_id, '')     || '|' ||
    coalesce(r_reason, '')        || '|' ||
    coalesce(r_input_hash, '')    || '|' ||
    coalesce(r_ip, '')            || '|' ||
    coalesce(r_user_agent, '')    || '|' ||
    coalesce(r_detail::text, '')  || '|' ||
    to_char(r_created AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
    r_seq::text,
  'sha256'), 'hex');
$$ LANGUAGE sql IMMUTABLE;

-- ── Backfill the chain over existing rows, oldest first ─────────────────────
DO $$
DECLARE
  r RECORD;
  seq BIGINT := 0;
  prev TEXT := 'GENESIS';
BEGIN
  FOR r IN SELECT * FROM "AuditLog" ORDER BY "createdAt", id LOOP
    seq := seq + 1;
    UPDATE "AuditLog" SET
      "chainSeq" = seq,
      "prevHash" = prev,
      "hash" = audit_row_hash(prev, r.id, r."actorId", CASE WHEN r."actorId" IS NULL THEN 'SYSTEM' ELSE 'HUMAN' END,
                              r.action, r.entity, r."entityId", r.reason, r."inputHash",
                              r.ip, r."userAgent", r.detail, r."createdAt", seq)
    WHERE id = r.id;
    SELECT "hash" INTO prev FROM "AuditLog" WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "AuditLog"
    ALTER COLUMN "actorType" SET NOT NULL,
    ALTER COLUMN "chainSeq" SET NOT NULL,
    ALTER COLUMN "prevHash" SET NOT NULL,
    ALTER COLUMN "hash" SET NOT NULL;

CREATE UNIQUE INDEX "AuditLog_chainSeq_key" ON "AuditLog"("chainSeq");
-- F1 census gap: the global feed needs a plain createdAt sort.
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ── Chain trigger: chainSeq + prevHash + hash assigned under the lock ──────
CREATE OR REPLACE FUNCTION audit_chain_before_insert() RETURNS trigger AS $$
DECLARE
  last_hash TEXT;
  last_seq BIGINT;
BEGIN
  -- Serializes audit inserts across transactions until commit: chain order
  -- is exactly lock-acquisition order, so links can never cross.
  PERFORM pg_advisory_xact_lock(hashtext('AuditLog-chain'));
  SELECT "hash", "chainSeq" INTO last_hash, last_seq
    FROM "AuditLog" ORDER BY "chainSeq" DESC LIMIT 1;
  NEW."chainSeq" := COALESCE(last_seq, 0) + 1;
  NEW."prevHash" := COALESCE(last_hash, 'GENESIS');
  NEW."actorType" := COALESCE(NEW."actorType", CASE WHEN NEW."actorId" IS NULL THEN 'SYSTEM' ELSE 'HUMAN' END);
  NEW."createdAt" := COALESCE(NEW."createdAt", CURRENT_TIMESTAMP);
  NEW."hash" := audit_row_hash(NEW."prevHash", NEW.id, NEW."actorId", NEW."actorType",
                               NEW.action, NEW.entity, NEW."entityId", NEW.reason, NEW."inputHash",
                               NEW.ip, NEW."userAgent", NEW.detail, NEW."createdAt", NEW."chainSeq");
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_chain
  BEFORE INSERT ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_chain_before_insert();

-- ── Append-only, enforced where it cannot be argued with ───────────────────
CREATE OR REPLACE FUNCTION audit_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only — % is forbidden', TG_OP
    USING ERRCODE = 'raise_exception';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_block_mutation();
CREATE TRIGGER audit_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_block_mutation();
CREATE TRIGGER audit_no_truncate
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_block_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM PUBLIC;
