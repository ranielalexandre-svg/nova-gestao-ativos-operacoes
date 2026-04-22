/*
  Warnings:

  - You are about to drop the column `handoffId` on the `ActivityEntry` table. All the data in the column will be lost.
  - You are about to drop the `Responsibility` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShiftHandoff` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ActivityEntry" DROP CONSTRAINT "ActivityEntry_handoffId_fkey";

-- DropForeignKey
ALTER TABLE "Responsibility" DROP CONSTRAINT "Responsibility_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "Responsibility" DROP CONSTRAINT "Responsibility_maintenanceId_fkey";

-- DropForeignKey
ALTER TABLE "Responsibility" DROP CONSTRAINT "Responsibility_occurrenceId_fkey";

-- DropForeignKey
ALTER TABLE "Responsibility" DROP CONSTRAINT "Responsibility_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "Responsibility" DROP CONSTRAINT "Responsibility_unitId_fkey";

-- DropForeignKey
ALTER TABLE "Responsibility" DROP CONSTRAINT "Responsibility_userId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftHandoff" DROP CONSTRAINT "ShiftHandoff_closedById_fkey";

-- DropForeignKey
ALTER TABLE "ShiftHandoff" DROP CONSTRAINT "ShiftHandoff_createdById_fkey";

-- DropIndex
DROP INDEX "ActivityEntry_handoffId_idx";

-- AlterTable
ALTER TABLE "ActivityEntry" DROP COLUMN "handoffId",
ADD COLUMN     "automationId" TEXT,
ADD COLUMN     "automationRunId" TEXT,
ADD COLUMN     "exceptionId" TEXT,
ADD COLUMN     "integrationId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- DropTable
DROP TABLE "Responsibility";

-- DropTable
DROP TABLE "ShiftHandoff";

-- CreateTable
CREATE TABLE "ExceptionCase" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'generic',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "fingerprint" TEXT,
    "silencedUntil" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "assigneeUserId" TEXT,
    "automationId" TEXT,
    "partnerId" TEXT,
    "unitId" TEXT,
    "equipmentId" TEXT,
    "integrationId" TEXT,
    "occurrenceId" TEXT,
    "maintenanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExceptionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detector" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'high',
    "cadence" TEXT NOT NULL DEFAULT 'every_5_minutes',
    "thresholdMinutes" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createExceptions" BOOLEAN NOT NULL DEFAULT true,
    "createActivities" BOOLEAN NOT NULL DEFAULT true,
    "resolveOnRecovery" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "hitsCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExceptionCase_code_key" ON "ExceptionCase"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExceptionCase_fingerprint_key" ON "ExceptionCase"("fingerprint");

-- CreateIndex
CREATE INDEX "ExceptionCase_status_idx" ON "ExceptionCase"("status");

-- CreateIndex
CREATE INDEX "ExceptionCase_severity_idx" ON "ExceptionCase"("severity");

-- CreateIndex
CREATE INDEX "ExceptionCase_source_idx" ON "ExceptionCase"("source");

-- CreateIndex
CREATE INDEX "ExceptionCase_assigneeUserId_idx" ON "ExceptionCase"("assigneeUserId");

-- CreateIndex
CREATE INDEX "ExceptionCase_automationId_idx" ON "ExceptionCase"("automationId");

-- CreateIndex
CREATE INDEX "ExceptionCase_partnerId_idx" ON "ExceptionCase"("partnerId");

-- CreateIndex
CREATE INDEX "ExceptionCase_unitId_idx" ON "ExceptionCase"("unitId");

-- CreateIndex
CREATE INDEX "ExceptionCase_equipmentId_idx" ON "ExceptionCase"("equipmentId");

-- CreateIndex
CREATE INDEX "ExceptionCase_integrationId_idx" ON "ExceptionCase"("integrationId");

-- CreateIndex
CREATE INDEX "ExceptionCase_occurrenceId_idx" ON "ExceptionCase"("occurrenceId");

-- CreateIndex
CREATE INDEX "ExceptionCase_maintenanceId_idx" ON "ExceptionCase"("maintenanceId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_code_key" ON "AutomationRule"("code");

-- CreateIndex
CREATE INDEX "AutomationRule_enabled_idx" ON "AutomationRule"("enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_detector_idx" ON "AutomationRule"("detector");

-- CreateIndex
CREATE INDEX "AutomationRule_cadence_idx" ON "AutomationRule"("cadence");

-- CreateIndex
CREATE INDEX "AutomationRule_nextRunAt_idx" ON "AutomationRule"("nextRunAt");

-- CreateIndex
CREATE INDEX "AutomationRun_ruleId_idx" ON "AutomationRun"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");

-- CreateIndex
CREATE INDEX "AutomationRun_startedAt_idx" ON "AutomationRun"("startedAt");

-- CreateIndex
CREATE INDEX "ActivityEntry_source_idx" ON "ActivityEntry"("source");

-- CreateIndex
CREATE INDEX "ActivityEntry_exceptionId_idx" ON "ActivityEntry"("exceptionId");

-- CreateIndex
CREATE INDEX "ActivityEntry_automationId_idx" ON "ActivityEntry"("automationId");

-- CreateIndex
CREATE INDEX "ActivityEntry_automationRunId_idx" ON "ActivityEntry"("automationRunId");

-- CreateIndex
CREATE INDEX "ActivityEntry_integrationId_idx" ON "ActivityEntry"("integrationId");

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionCase" ADD CONSTRAINT "ExceptionCase_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "Maintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "ExceptionCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
