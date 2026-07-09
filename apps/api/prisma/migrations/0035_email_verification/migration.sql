-- STAKES/S-12 F-11 — hybrid verification contract: email verification is the
-- BASELINE identity tier (gates commenting / following / engagement
-- notifications); Nafath stays the separate money-tier KYC.

ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Grandfather clause (user decision 2026-07-09): every EXISTING account is
-- treated as verified so nobody loses features they already use. Only
-- accounts created after this migration must verify.
UPDATE "User" SET "emailVerified" = true;

-- One-time verification tokens. purpose SIGNUP = first verification;
-- EMAIL_CHANGE = confirm a new address (F-06) — newEmail carries the target.
CREATE TABLE "EmailVerifyToken" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"    UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose"   TEXT NOT NULL DEFAULT 'SIGNUP',
    "newEmail"  TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerifyToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerifyToken_tokenHash_key" ON "EmailVerifyToken"("tokenHash");
CREATE INDEX "EmailVerifyToken_userId_idx" ON "EmailVerifyToken"("userId");

-- STAKES/S-12 F-08 — refund-completed gets its own notification kind.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'REFUND_COMPLETED';
