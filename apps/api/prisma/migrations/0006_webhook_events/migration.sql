-- Sprint 1 / P0-003: inbound PSP webhook idempotency ledger.
-- Hand-written per house rule (never auto-diff: protects the searchVector
-- generated column on "Project" from being dropped by prisma migrate dev).

CREATE TABLE "WebhookEvent" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider"    TEXT NOT NULL DEFAULT 'moyasar',
    "eventType"   TEXT NOT NULL,
    "pspRef"      TEXT NOT NULL,
    "dedupKey"    TEXT NOT NULL,
    "payload"     JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "outcome"     TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_dedupKey_key" ON "WebhookEvent"("dedupKey");
CREATE INDEX "WebhookEvent_pspRef_idx" ON "WebhookEvent"("pspRef");
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");
