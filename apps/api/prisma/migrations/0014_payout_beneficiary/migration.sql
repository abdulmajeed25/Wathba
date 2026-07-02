-- Sprint 5 / #7: creator payout beneficiary (Moyasar destination).
-- Hand-written per house rule (protects the searchVector generated column).

CREATE TYPE "BeneficiaryType" AS ENUM ('BANK_ACCOUNT', 'WALLET');

CREATE TABLE "PayoutBeneficiary" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"           UUID NOT NULL,
    "type"             "BeneficiaryType" NOT NULL DEFAULT 'BANK_ACCOUNT',
    "iban"             TEXT,
    "name"             TEXT NOT NULL,
    "mobile"           TEXT NOT NULL,
    "country"          TEXT NOT NULL DEFAULT 'SA',
    "city"             TEXT,
    "moyasarAccountId" TEXT,
    "verifiedAt"       TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutBeneficiary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayoutBeneficiary_userId_key" ON "PayoutBeneficiary"("userId");

ALTER TABLE "PayoutBeneficiary" ADD CONSTRAINT "PayoutBeneficiary_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
