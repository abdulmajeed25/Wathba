-- The creator's choice of what their CARD shows: the campaign video on hover,
-- or the cover image only. VIDEO is the default and means "video if there is
-- one" — a project with no videoUrl renders its cover either way, so every
-- existing row keeps exactly the behaviour it has today.
CREATE TYPE "ProjectCardMedia" AS ENUM ('VIDEO', 'POSTER');

ALTER TABLE "Project"
  ADD COLUMN "cardMedia" "ProjectCardMedia" NOT NULL DEFAULT 'VIDEO';
