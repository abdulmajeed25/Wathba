-- Batch OPS-GAPS Y2 — operator overrides of transactional email templates.
-- Hand-written.

CREATE TABLE "EmailTemplateOverride" (
    "key" TEXT NOT NULL,
    "subjectAr" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTemplateOverride_pkey" PRIMARY KEY ("key")
);
