-- Nullable for historical pledges. New HTTP requests require a UUID key.
ALTER TABLE "Pledge" ADD COLUMN "requestKey" TEXT;
ALTER TABLE "Pledge" ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "Pledge_backerId_requestKey_key" ON "Pledge"("backerId", "requestKey");
