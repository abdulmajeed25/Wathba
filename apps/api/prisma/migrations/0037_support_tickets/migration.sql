-- STAKES/S-15 (H4) — contact/support requests: stored server-side AND
-- forwarded to the support inbox, so "اتصل بنا" actually delivers.
CREATE TABLE "SupportTicket" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"    UUID,
    "name"      TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "topic"     TEXT NOT NULL,
    "messageAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");
