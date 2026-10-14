-- Historical attempts stay NULL: never reconstruct accepted terms from today's campaign.
ALTER TABLE "Pledge" ADD COLUMN "authorizationContext" JSONB;
