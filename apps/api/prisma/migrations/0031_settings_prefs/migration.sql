-- STAKES / S-7 (E2 E3): notification preferences + profile privacy.
-- Hand-written per house rule. Does NOT touch "Project".

ALTER TABLE "User" ADD COLUMN "notificationPrefs" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "profilePublic"     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "showBackedCount"   BOOLEAN NOT NULL DEFAULT true;
