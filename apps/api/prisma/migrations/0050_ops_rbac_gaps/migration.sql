-- OPS-360 Phase B Unit 1 — RBAC gap closure (census A6). Hand-written.
-- Keeps the seeded OpsRole.permissions arrays in lock-step with the code
-- matrix in src/ops/permissions.ts. Three system roles change:
--   · MODERATOR   — was blind; grant 'analytics.read' so the trust dashboard
--                   (/ops/dashboard, gated analytics.read) + its counts load.
--   · OPS_MANAGER — grant 'users.roles.assign' (merge / grant-ops-roles /
--                   re-homed pdpl.erase) and the new 'procurement.read' key.
-- No new table/column: the 'procurement.read' catalog key needs no DDL — it
-- lives only inside the TEXT[] permissions array. isSystem rows only.
-- Idempotent: sets the full array to the canonical value by key.

UPDATE "OpsRole"
   SET "permissions" = ARRAY['moderation.queue','analytics.read'],
       "updatedAt"   = CURRENT_TIMESTAMP
 WHERE "key" = 'MODERATOR';

UPDATE "OpsRole"
   SET "permissions" = ARRAY[
         'projects.review','projects.feature','projects.lifecycle',
         'procurement.read','moderation.queue','users.lifecycle',
         'users.roles.assign','content.editorial','content.collections',
         'content.categories','support.tickets','analytics.read','audit.read'
       ],
       "updatedAt"   = CURRENT_TIMESTAMP
 WHERE "key" = 'OPS_MANAGER';
