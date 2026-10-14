ALTER TYPE "PledgeStatus" ADD VALUE 'PENDING_AUTH';
ALTER TABLE "Pledge" ADD COLUMN "authorizationIssue" TEXT;
