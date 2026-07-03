-- Creator-CC / CC-04: notify the creator when their project is approved/rejected.
-- Hand-written per house rule (protects the searchVector generated column).
-- ALTER TYPE ADD VALUE cannot run inside a transaction block with other DDL;
-- it is a standalone additive enum change.

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PROJECT_REVIEWED';
