-- STAKES/S-14 (P4-audit) — new-device sign-in notice. Privacy posture: we
-- store a salted HASH of the user-agent only (no IP, no raw UA), enough to
-- tell "first time this browser signs in" from "seen before".
CREATE TABLE "KnownDevice" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"     UUID NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnownDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnownDevice_userId_deviceHash_key" ON "KnownDevice"("userId", "deviceHash");
CREATE INDEX "KnownDevice_userId_idx" ON "KnownDevice"("userId");
