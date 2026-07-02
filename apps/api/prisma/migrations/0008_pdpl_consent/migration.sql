-- Sprint 2 / P0-702: PDPL consent capture.
-- Hand-written per house rule (protects the searchVector generated column).

ALTER TABLE "User" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "consentAt" TIMESTAMP(3);
