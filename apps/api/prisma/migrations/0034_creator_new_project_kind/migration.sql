-- STAKES/S-11 F-05 — follower fan-out on publish gets its own notification
-- kind. (PG 12+ allows ADD VALUE inside the migration transaction as long as
-- the enum wasn't created in the same transaction.)
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'CREATOR_NEW_PROJECT';
