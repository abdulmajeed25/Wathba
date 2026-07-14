-- OPS Part 1 — hardened integration, hand-written.
--
-- OpsSession: the SEPARATE admin session for مركز العمليات. Opaque token
-- (only the SHA-256 is stored), independent of the public session:
-- 60-minute idle window (lastSeenAt slides), 8-hour absolute cap, explicit
-- revocation. stepUpAt = last password/TOTP re-entry; MONEY and SENSITIVE
-- operations require it within the last 10 minutes. stepUpAt is NULL while
-- TOTP is required but not yet enrolled (browse + enroll only).
CREATE TABLE "OpsSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stepUpAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,

    CONSTRAINT "OpsSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpsSession_tokenHash_key" ON "OpsSession"("tokenHash");
CREATE INDEX "OpsSession_userId_revokedAt_idx" ON "OpsSession"("userId", "revokedAt");

-- OpsCredential: TOTP enrollment. Secret AES-256-GCM encrypted at rest
-- (key derived from JWT_SECRET); backup codes stored as SHA-256 hashes,
-- single-use (a consumed code is removed from the array).
CREATE TABLE "OpsCredential" (
    "userId" UUID NOT NULL,
    "totpSecretEnc" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "backupCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsCredential_pkey" PRIMARY KEY ("userId")
);
