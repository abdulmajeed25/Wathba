-- Creator-CC / CC-24: per-project collaborators with content-scoped access.
-- Hand-written per house rule (protects the searchVector generated column).

CREATE TABLE "ProjectCollaborator" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "userId"    UUID NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCollaborator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectCollaborator_projectId_userId_key" ON "ProjectCollaborator"("projectId", "userId");
CREATE INDEX "ProjectCollaborator_userId_idx" ON "ProjectCollaborator"("userId");

ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
