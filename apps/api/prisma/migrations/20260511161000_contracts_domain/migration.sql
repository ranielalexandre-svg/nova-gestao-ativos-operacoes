-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "type" TEXT NOT NULL DEFAULT 'corporate',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceContractLabel" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "monthlyValueCents" INTEGER,
    "paymentMethod" TEXT,
    "billingCycle" TEXT,
    "adjustmentIndex" TEXT,
    "renewalMode" TEXT,
    "loyaltyMonths" INTEGER,
    "terminationPenalty" TEXT,
    "slaPercent" DOUBLE PRECISION,
    "notes" TEXT,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractUnit" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'covered',
    "status" TEXT NOT NULL DEFAULT 'active',
    "addressLine" TEXT,
    "bandwidthLabel" TEXT,
    "bandwidthMbps" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractService" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractBilling" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "amountCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractContact" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_partnerId_code_key" ON "Contract"("partnerId", "code");

-- CreateIndex
CREATE INDEX "Contract_partnerId_idx" ON "Contract"("partnerId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_startsAt_idx" ON "Contract"("startsAt");

-- CreateIndex
CREATE INDEX "Contract_endsAt_idx" ON "Contract"("endsAt");

-- CreateIndex
CREATE INDEX "Contract_source_idx" ON "Contract"("source");

-- CreateIndex
CREATE UNIQUE INDEX "ContractUnit_contractId_unitId_key" ON "ContractUnit"("contractId", "unitId");

-- CreateIndex
CREATE INDEX "ContractUnit_contractId_idx" ON "ContractUnit"("contractId");

-- CreateIndex
CREATE INDEX "ContractUnit_unitId_idx" ON "ContractUnit"("unitId");

-- CreateIndex
CREATE INDEX "ContractUnit_status_idx" ON "ContractUnit"("status");

-- CreateIndex
CREATE INDEX "ContractService_contractId_idx" ON "ContractService"("contractId");

-- CreateIndex
CREATE INDEX "ContractService_status_idx" ON "ContractService"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractBilling_contractId_referenceMonth_key" ON "ContractBilling"("contractId", "referenceMonth");

-- CreateIndex
CREATE INDEX "ContractBilling_contractId_idx" ON "ContractBilling"("contractId");

-- CreateIndex
CREATE INDEX "ContractBilling_status_idx" ON "ContractBilling"("status");

-- CreateIndex
CREATE INDEX "ContractBilling_dueDate_idx" ON "ContractBilling"("dueDate");

-- CreateIndex
CREATE INDEX "ContractContact_contractId_idx" ON "ContractContact"("contractId");

-- CreateIndex
CREATE INDEX "ContractContact_isPrimary_idx" ON "ContractContact"("isPrimary");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractUnit" ADD CONSTRAINT "ContractUnit_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractUnit" ADD CONSTRAINT "ContractUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractService" ADD CONSTRAINT "ContractService_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractBilling" ADD CONSTRAINT "ContractBilling_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractContact" ADD CONSTRAINT "ContractContact_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill contracts from legacy unit report metadata.
INSERT INTO "Contract" (
    "id",
    "code",
    "title",
    "status",
    "type",
    "source",
    "sourceContractLabel",
    "partnerId",
    "startsAt",
    "endsAt",
    "signedAt",
    "paymentMethod",
    "billingCycle",
    "adjustmentIndex",
    "renewalMode",
    "slaPercent",
    "createdAt",
    "updatedAt"
)
SELECT
    'contract_' || md5(u."partnerId" || ':' || TRIM(u."reportContractLabel")) AS "id",
    TRIM(u."reportContractLabel") AS "code",
    'Contrato ' || TRIM(u."reportContractLabel") AS "title",
    'active' AS "status",
    'corporate' AS "type",
    'unit_report_metadata' AS "source",
    TRIM(u."reportContractLabel") AS "sourceContractLabel",
    u."partnerId",
    TIMESTAMP '2026-04-01 00:00:00' AS "startsAt",
    TIMESTAMP '2028-03-31 00:00:00' AS "endsAt",
    TIMESTAMP '2026-04-30 00:00:00' AS "signedAt",
    'Boleto bancário' AS "paymentMethod",
    'Mensal' AS "billingCycle",
    'IPCA' AS "adjustmentIndex",
    'automatic' AS "renewalMode",
    99.8 AS "slaPercent",
    CURRENT_TIMESTAMP AS "createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "Unit" u
WHERE u."reportContractLabel" IS NOT NULL
  AND TRIM(u."reportContractLabel") <> ''
GROUP BY u."partnerId", TRIM(u."reportContractLabel")
ON CONFLICT ("partnerId", "code") DO NOTHING;

INSERT INTO "ContractUnit" (
    "id",
    "contractId",
    "unitId",
    "role",
    "status",
    "addressLine",
    "bandwidthLabel",
    "bandwidthMbps",
    "createdAt",
    "updatedAt"
)
SELECT
    'contract_unit_' || md5(c.id || ':' || u.id) AS "id",
    c.id AS "contractId",
    u.id AS "unitId",
    'covered' AS "role",
    CASE WHEN u."isActive" THEN 'active' ELSE 'inactive' END AS "status",
    u."reportAddressLine" AS "addressLine",
    u."reportContractedBandwidth" AS "bandwidthLabel",
    NULLIF(substring(replace(COALESCE(u."reportContractedBandwidth", ''), ',', '.') FROM '[0-9]+[.]?[0-9]*'), '')::double precision AS "bandwidthMbps",
    CURRENT_TIMESTAMP AS "createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "Unit" u
JOIN "Contract" c
  ON c."partnerId" = u."partnerId"
 AND c."code" = TRIM(u."reportContractLabel")
WHERE u."reportContractLabel" IS NOT NULL
  AND TRIM(u."reportContractLabel") <> ''
ON CONFLICT ("contractId", "unitId") DO NOTHING;

INSERT INTO "ContractService" (
    "id",
    "contractId",
    "name",
    "description",
    "serviceType",
    "status",
    "sortOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    'contract_service_' || md5(c.id || ':internet') AS "id",
    c.id AS "contractId",
    'Internet Dedicada' AS "name",
    'Link corporativo coberto pelo contrato.' AS "description",
    'internet_dedicada' AS "serviceType",
    'active' AS "status",
    10 AS "sortOrder",
    CURRENT_TIMESTAMP AS "createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "Contract" c
WHERE c."source" = 'unit_report_metadata'
ON CONFLICT DO NOTHING;
