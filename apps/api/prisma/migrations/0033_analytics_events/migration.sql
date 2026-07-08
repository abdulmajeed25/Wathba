-- STAKES / S-9 (O1 O3): privacy-respecting product event store.
-- Hand-written per house rule. No IP / UA columns BY DESIGN (PDPL).

CREATE TABLE "AnalyticsEvent" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "name"      TEXT NOT NULL,
    "anonId"    TEXT,
    "userId"    UUID,
    "path"      TEXT,
    "props"     JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
