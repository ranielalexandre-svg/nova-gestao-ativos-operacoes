-- CreateTable
CREATE TABLE "StarlinkOperationalInfo" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'legacy_sqlite',
    "legacyId" TEXT NOT NULL,
    "antennaId" TEXT,
    "localName" TEXT,
    "kitSerial" TEXT,
    "antennaSerial" TEXT,
    "ipvpn" TEXT,
    "plan" TEXT,
    "installer" TEXT,
    "installedAt" TEXT,
    "notes" TEXT,
    "emailEnc" TEXT,
    "passwordEnc" TEXT,
    "cardEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StarlinkOperationalInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StarlinkOperationalInfo_legacyId_key" ON "StarlinkOperationalInfo"("legacyId");

-- CreateIndex
CREATE INDEX "StarlinkOperationalInfo_equipmentId_idx" ON "StarlinkOperationalInfo"("equipmentId");

-- CreateIndex
CREATE INDEX "StarlinkOperationalInfo_antennaId_idx" ON "StarlinkOperationalInfo"("antennaId");

-- CreateIndex
CREATE INDEX "StarlinkOperationalInfo_kitSerial_idx" ON "StarlinkOperationalInfo"("kitSerial");

-- AddForeignKey
ALTER TABLE "StarlinkOperationalInfo" ADD CONSTRAINT "StarlinkOperationalInfo_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
