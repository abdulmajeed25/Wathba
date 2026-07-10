-- Batch SEARCH Part 2 — suggest-path indexes. The project side already has
-- the tsvector GIN + pg_trgm (N2); the creator + category lookups in
-- /v1/search/suggest were seq scans. Trigram GIN covers the contains()
-- matches; the handle prefix uses text_pattern_ops.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx" ON "User" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_handle_prefix_idx" ON "User" ("handle" text_pattern_ops);
CREATE INDEX IF NOT EXISTS "Category_nameAr_trgm_idx" ON "Category" USING gin ("nameAr" gin_trgm_ops);
