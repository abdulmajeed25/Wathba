-- Grant ADMIN role to a user by email. Idempotent — running twice is a no-op.
--
-- Usage:
--   PGPASSWORD=$DB_PWD psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
--     -v email="'admin@wathba.demo'" \
--     -f apps/api/prisma/_seed/grant-admin.sql
--
-- After granting, the user must sign in again to pick up the new role in
-- their JWT (the role is embedded at issue time, not validated per request).
-- Admin endpoints under /v1/admin/* and the milestone /approve + /release
-- ops (Tier 1.6) all check @Roles('ADMIN').

UPDATE "User"
   SET roles = ARRAY(
         SELECT DISTINCT unnest(roles || ARRAY['ADMIN'::"UserRole"])
       )
 WHERE email = :email
   AND NOT 'ADMIN'::"UserRole" = ANY(roles);

-- Confirm the result. Empty output = no rows matched (check the email).
SELECT id, email, name, roles FROM "User" WHERE email = :email;
