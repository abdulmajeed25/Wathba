-- Sprint 2 / P1-502: rotating refresh tokens.
-- Hand-written per house rule (protects the searchVector generated column).

CREATE TABLE "RefreshToken" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"       UUID NOT NULL,
    "tokenHash"    TEXT NOT NULL,
    "expiresAt"    TIMESTAMP(3) NOT NULL,
    "revokedAt"    TIMESTAMP(3),
    "replacedById" UUID,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");
