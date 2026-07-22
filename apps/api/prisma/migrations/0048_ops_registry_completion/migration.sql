-- Batch OPS (registry completion) — schema ground for the missing governed
-- operations: user suspension/ban, project takedown, support-ticket
-- lifecycle + notes, DB-backed platform settings, reconciliation runs, and
-- the two account-lifecycle notification kinds.
-- Hand-written.

-- ── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "SuspensionKind" AS ENUM ('SUSPENDED', 'BANNED');

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

ALTER TYPE "NotificationKind" ADD VALUE 'ACCOUNT_SUSPENDED';
ALTER TYPE "NotificationKind" ADD VALUE 'ACCOUNT_REACTIVATED';

-- ── User: suspension / ban (users.suspend · moderation.user.ban) ────────────

ALTER TABLE "User"
    ADD COLUMN "suspendedAt" TIMESTAMP(3),
    ADD COLUMN "suspendedKind" "SuspensionKind",
    ADD COLUMN "suspendedReasonAr" TEXT;

-- ── Project: trust-&-safety takedown (moderation.project.hide/unhide) ───────

ALTER TABLE "Project"
    ADD COLUMN "hiddenAt" TIMESTAMP(3),
    ADD COLUMN "hiddenReasonAr" TEXT;

-- ── SupportTicket: lifecycle (support.ticket.*) ─────────────────────────────

ALTER TABLE "SupportTicket"
    ADD COLUMN "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    ADD COLUMN "assignedToId" UUID,
    ADD COLUMN "resolvedAt" TIMESTAMP(3),
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");
CREATE INDEX "SupportTicket_assignedToId_status_idx" ON "SupportTicket"("assignedToId", "status");

CREATE TABLE "SupportTicketNote" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "noteAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketNote_ticketId_createdAt_idx" ON "SupportTicketNote"("ticketId", "createdAt");

ALTER TABLE "SupportTicketNote"
    ADD CONSTRAINT "SupportTicketNote_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── PlatformSetting (settings.update) ───────────────────────────────────────

CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" UUID,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- ── ReconciliationRun (money.reconcile.run) ─────────────────────────────────

CREATE TABLE "ReconciliationRun" (
    "id" UUID NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "scanned" INTEGER NOT NULL,
    "matched" INTEGER NOT NULL,
    "mismatched" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "mismatches" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'moyasar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReconciliationRun_createdAt_idx" ON "ReconciliationRun"("createdAt");
