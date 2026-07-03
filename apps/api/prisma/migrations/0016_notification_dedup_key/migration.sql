-- Creator-CC / CC-01: idempotency guard for notification fan-out.
-- Hand-written per house rule (protects the searchVector generated column).
-- Nullable + UNIQUE: Postgres permits many NULLs, so one-off notifications
-- are unaffected while fan-out kinds dedupe on `update:{updateId}:{userId}`.

ALTER TABLE "Notification" ADD COLUMN "dedupKey" TEXT;

CREATE UNIQUE INDEX "Notification_dedupKey_key" ON "Notification"("dedupKey");
