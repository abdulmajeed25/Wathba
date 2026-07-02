-- Sprint 2 / P0-701: ZATCA e-invoices on platform commission.
-- Hand-written per house rule (protects the searchVector generated column).

CREATE TABLE "ZatcaInvoice" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceNumber"     TEXT NOT NULL,
    "payoutId"          UUID NOT NULL,
    "creatorId"         UUID NOT NULL,
    "commissionHalalas" BIGINT NOT NULL,
    "vatHalalas"        BIGINT NOT NULL,
    "totalHalalas"      BIGINT NOT NULL,
    "qrTlv"             TEXT NOT NULL,
    "payload"           JSONB NOT NULL,
    "issuedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedAt"        TIMESTAMP(3),

    CONSTRAINT "ZatcaInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ZatcaInvoice_invoiceNumber_key" ON "ZatcaInvoice"("invoiceNumber");
CREATE UNIQUE INDEX "ZatcaInvoice_payoutId_key" ON "ZatcaInvoice"("payoutId");
CREATE INDEX "ZatcaInvoice_creatorId_issuedAt_idx" ON "ZatcaInvoice"("creatorId", "issuedAt");
