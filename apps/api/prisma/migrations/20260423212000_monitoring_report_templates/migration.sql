-- CreateTable
CREATE TABLE "MonitoringReportTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "integrationId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "periodPreset" TEXT NOT NULL DEFAULT 'last_7_days',
    "groupIds" TEXT,
    "unitIds" TEXT,
    "outputFormat" TEXT NOT NULL DEFAULT 'pdf',
    "includeCharts" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "interestedParty" TEXT,
    "contractLabel" TEXT,
    "addressLine" TEXT,
    "contractedBandwidth" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringReportTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AutomationRule"
ADD COLUMN "reportTemplateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringReportTemplate_code_key" ON "MonitoringReportTemplate"("code");
CREATE INDEX "MonitoringReportTemplate_integrationId_idx" ON "MonitoringReportTemplate"("integrationId");
CREATE INDEX "MonitoringReportTemplate_sourceType_idx" ON "MonitoringReportTemplate"("sourceType");
CREATE INDEX "MonitoringReportTemplate_periodPreset_idx" ON "MonitoringReportTemplate"("periodPreset");
CREATE INDEX "MonitoringReportTemplate_enabled_idx" ON "MonitoringReportTemplate"("enabled");
CREATE INDEX "AutomationRule_reportTemplateId_idx" ON "AutomationRule"("reportTemplateId");

-- AddForeignKey
ALTER TABLE "MonitoringReportTemplate"
ADD CONSTRAINT "MonitoringReportTemplate_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationRule"
ADD CONSTRAINT "AutomationRule_reportTemplateId_fkey"
FOREIGN KEY ("reportTemplateId") REFERENCES "MonitoringReportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
