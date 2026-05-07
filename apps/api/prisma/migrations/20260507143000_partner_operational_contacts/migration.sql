-- CreateTable
CREATE TABLE "PartnerOperationalContact" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'legacy_sqlite',
    "sourceLegacyId" TEXT,
    "city" TEXT,
    "name" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerOperationalContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOperationalContact_source_sourceLegacyId_key" ON "PartnerOperationalContact"("source", "sourceLegacyId");

-- CreateIndex
CREATE INDEX "PartnerOperationalContact_partnerId_idx" ON "PartnerOperationalContact"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerOperationalContact_source_idx" ON "PartnerOperationalContact"("source");

-- AddForeignKey
ALTER TABLE "PartnerOperationalContact" ADD CONSTRAINT "PartnerOperationalContact_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
