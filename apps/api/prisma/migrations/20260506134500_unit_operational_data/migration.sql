-- CreateTable
CREATE TABLE "UnitOperationalInfo" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'legacy',
    "sourceLegacyId" TEXT,
    "sourceUnitKey" TEXT,
    "sourceHash" TEXT,
    "linkRole" TEXT NOT NULL DEFAULT 'primary',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "group" TEXT,
    "legacyCode" TEXT,
    "legacyName" TEXT,
    "city" TEXT,
    "state" TEXT,
    "partnerCode" TEXT,
    "serviceType" TEXT,
    "connectionType" TEXT,
    "routerPort" TEXT,
    "technology" TEXT,
    "latency" TEXT,
    "macOnu" TEXT,
    "phone" TEXT,
    "contractIxc" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOperationalInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOperationalSecret" (
    "id" TEXT NOT NULL,
    "operationalInfoId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'credential',
    "label" TEXT NOT NULL,
    "usernameEnc" TEXT,
    "secretEnc" TEXT,
    "noteEnc" TEXT,
    "hasValue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOperationalSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitOperationalInfo_sourceHash_key" ON "UnitOperationalInfo"("sourceHash");

-- CreateIndex
CREATE INDEX "UnitOperationalInfo_unitId_idx" ON "UnitOperationalInfo"("unitId");

-- CreateIndex
CREATE INDEX "UnitOperationalInfo_source_idx" ON "UnitOperationalInfo"("source");

-- CreateIndex
CREATE INDEX "UnitOperationalInfo_sourceUnitKey_idx" ON "UnitOperationalInfo"("sourceUnitKey");

-- CreateIndex
CREATE INDEX "UnitOperationalInfo_partnerCode_idx" ON "UnitOperationalInfo"("partnerCode");

-- CreateIndex
CREATE INDEX "UnitOperationalInfo_linkRole_idx" ON "UnitOperationalInfo"("linkRole");

-- CreateIndex
CREATE INDEX "UnitOperationalSecret_operationalInfoId_idx" ON "UnitOperationalSecret"("operationalInfoId");

-- CreateIndex
CREATE INDEX "UnitOperationalSecret_kind_idx" ON "UnitOperationalSecret"("kind");

-- AddForeignKey
ALTER TABLE "UnitOperationalInfo" ADD CONSTRAINT "UnitOperationalInfo_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOperationalSecret" ADD CONSTRAINT "UnitOperationalSecret_operationalInfoId_fkey" FOREIGN KEY ("operationalInfoId") REFERENCES "UnitOperationalInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
