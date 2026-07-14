-- OPS Part 2 — RBAC (OpsRole + OpsRoleGrant), the four-eyes approval queue
-- (OperationProposal), the 8 seeded system roles, and the OWNER backfill for
-- every existing ADMIN. Hand-written.

CREATE TABLE "OpsRole" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpsRole_key_key" ON "OpsRole"("key");

CREATE TABLE "OpsRoleGrant" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "grantedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsRoleGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpsRoleGrant_userId_roleId_key" ON "OpsRoleGrant"("userId", "roleId");
CREATE INDEX "OpsRoleGrant_userId_idx" ON "OpsRoleGrant"("userId");

ALTER TABLE "OpsRoleGrant"
    ADD CONSTRAINT "OpsRoleGrant_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "OpsRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OperationProposal" (
    "id" UUID NOT NULL,
    "operationKey" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "preview" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "riskTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "proposedById" TEXT NOT NULL,
    "proposedByType" TEXT NOT NULL DEFAULT 'HUMAN',
    "idempotencyKey" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "executionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationProposal_idempotencyKey_key" ON "OperationProposal"("idempotencyKey");
CREATE INDEX "OperationProposal_status_createdAt_idx" ON "OperationProposal"("status", "createdAt");
CREATE INDEX "OperationProposal_proposedById_createdAt_idx" ON "OperationProposal"("proposedById", "createdAt");

-- ── The 8 system roles (mirror of src/ops/permissions.ts ROLE_MATRIX) ──────
INSERT INTO "OpsRole" ("id", "key", "nameAr", "permissions", "isSystem", "updatedAt") VALUES
  (gen_random_uuid(), 'OWNER',          'المالك',            ARRAY['*'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'OPS_MANAGER',    'مدير العمليات',     ARRAY['projects.review','projects.feature','projects.lifecycle','moderation.queue','users.lifecycle','content.editorial','content.collections','content.categories','support.tickets','analytics.read','audit.read'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'REVIEWER',       'مراجع مشاريع',      ARRAY['projects.review'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FINANCE',        'المالية',           ARRAY['money.execute','money.approve','analytics.read','audit.read'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SUPPORT',        'الدعم',             ARRAY['users.lifecycle','users.pii.unmask','support.tickets'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MODERATOR',      'الثقة والسلامة',    ARRAY['moderation.queue'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CONTENT_EDITOR', 'محرر المحتوى',      ARRAY['content.editorial','content.collections','content.categories'], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ANALYST',        'محلل بيانات',       ARRAY['analytics.read','audit.read'], true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- ── OWNER backfill: solo operation keeps zero friction from day one ────────
INSERT INTO "OpsRoleGrant" ("id", "userId", "roleId")
SELECT gen_random_uuid(), u."id", r."id"
FROM "User" u
CROSS JOIN "OpsRole" r
WHERE r."key" = 'OWNER' AND 'ADMIN' = ANY(u."roles")
ON CONFLICT ("userId", "roleId") DO NOTHING;
