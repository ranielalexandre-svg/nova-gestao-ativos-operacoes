-- CreateTable
CREATE TABLE "SlaPolicy" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'generic',
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "queueKey" TEXT NOT NULL DEFAULT 'ops-general',
  "firstResponseMinutes" INTEGER NOT NULL DEFAULT 30,
  "resolveMinutes" INTEGER NOT NULL DEFAULT 240,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExceptionComment" (
  "id" TEXT NOT NULL,
  "exceptionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExceptionComment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ExceptionCase"
  ADD COLUMN "queueKey" TEXT NOT NULL DEFAULT 'ops-general',
  ADD COLUMN "classification" TEXT NOT NULL DEFAULT 'generic',
  ADD COLUMN "impact" TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN "urgency" TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN "priorityScore" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "triageStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
  ADD COLUMN "resolveDueAt" TIMESTAMP(3),
  ADD COLUMN "breachedAt" TIMESTAMP(3),
  ADD COLUMN "lastActivityAt" TIMESTAMP(3),
  ADD COLUMN "slaPolicyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_code_key" ON "SlaPolicy"("code");
CREATE INDEX "SlaPolicy_kind_idx" ON "SlaPolicy"("kind");
CREATE INDEX "SlaPolicy_severity_idx" ON "SlaPolicy"("severity");
CREATE INDEX "SlaPolicy_queueKey_idx" ON "SlaPolicy"("queueKey");
CREATE INDEX "SlaPolicy_isActive_idx" ON "SlaPolicy"("isActive");

CREATE INDEX "ExceptionComment_exceptionId_createdAt_idx" ON "ExceptionComment"("exceptionId", "createdAt");
CREATE INDEX "ExceptionComment_userId_idx" ON "ExceptionComment"("userId");

CREATE INDEX "ExceptionCase_queueKey_idx" ON "ExceptionCase"("queueKey");
CREATE INDEX "ExceptionCase_triageStatus_idx" ON "ExceptionCase"("triageStatus");
CREATE INDEX "ExceptionCase_priorityScore_idx" ON "ExceptionCase"("priorityScore");
CREATE INDEX "ExceptionCase_slaPolicyId_idx" ON "ExceptionCase"("slaPolicyId");
CREATE INDEX "ExceptionCase_firstResponseDueAt_idx" ON "ExceptionCase"("firstResponseDueAt");
CREATE INDEX "ExceptionCase_resolveDueAt_idx" ON "ExceptionCase"("resolveDueAt");
CREATE INDEX "ExceptionCase_breachedAt_idx" ON "ExceptionCase"("breachedAt");

-- AddForeignKey
ALTER TABLE "ExceptionCase"
  ADD CONSTRAINT "ExceptionCase_slaPolicyId_fkey"
  FOREIGN KEY ("slaPolicyId") REFERENCES "SlaPolicy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExceptionComment"
  ADD CONSTRAINT "ExceptionComment_exceptionId_fkey"
  FOREIGN KEY ("exceptionId") REFERENCES "ExceptionCase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExceptionComment"
  ADD CONSTRAINT "ExceptionComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default policies
INSERT INTO "SlaPolicy" ("id", "code", "name", "kind", "severity", "queueKey", "firstResponseMinutes", "resolveMinutes", "isActive", "createdAt", "updatedAt")
VALUES
  ('slapolicy_generic_low', 'SLA-GENERIC-LOW', 'SLA genérico low', 'generic', 'low', 'ops-general', 60, 480, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('slapolicy_generic_medium', 'SLA-GENERIC-MEDIUM', 'SLA genérico medium', 'generic', 'medium', 'ops-general', 30, 240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('slapolicy_generic_high', 'SLA-GENERIC-HIGH', 'SLA genérico high', 'generic', 'high', 'ops-general', 15, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('slapolicy_generic_critical', 'SLA-GENERIC-CRITICAL', 'SLA genérico critical', 'generic', 'critical', 'ops-general', 10, 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('slapolicy_integration_critical', 'SLA-INTEGRATION-CRITICAL', 'SLA integração crítica', 'integration', 'critical', 'ops-integracoes', 10, 45, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('slapolicy_occurrence_critical', 'SLA-OCCURRENCE-CRITICAL', 'SLA ocorrência crítica', 'occurrence', 'critical', 'ops-ocorrencias', 10, 45, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('slapolicy_maintenance_high', 'SLA-MAINTENANCE-HIGH', 'SLA manutenção high', 'maintenance', 'high', 'ops-manutencao', 30, 240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('slapolicy_sla_high', 'SLA-SLA-HIGH', 'SLA de aging high', 'sla', 'high', 'ops-sla', 15, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Backfill existing exceptions
UPDATE "ExceptionCase"
SET
  "classification" = COALESCE(NULLIF(LOWER(TRIM("kind")), ''), 'generic'),
  "queueKey" = CASE
    WHEN LOWER(TRIM("kind")) = 'integration' THEN 'ops-integracoes'
    WHEN LOWER(TRIM("kind")) = 'occurrence' THEN 'ops-ocorrencias'
    WHEN LOWER(TRIM("kind")) = 'maintenance' THEN 'ops-manutencao'
    WHEN LOWER(TRIM("kind")) = 'sla' THEN 'ops-sla'
    WHEN LOWER(TRIM("kind")) = 'automation' THEN 'ops-automacoes'
    ELSE 'ops-general'
  END,
  "impact" = CASE
    WHEN LOWER(TRIM("severity")) = 'critical' THEN 'critical'
    WHEN LOWER(TRIM("severity")) = 'high' THEN 'high'
    WHEN LOWER(TRIM("severity")) = 'medium' THEN 'medium'
    ELSE 'low'
  END,
  "urgency" = CASE
    WHEN LOWER(TRIM("status")) = 'resolved' THEN 'low'
    WHEN LOWER(TRIM("severity")) = 'critical' THEN 'critical'
    WHEN LOWER(TRIM("severity")) = 'high' THEN 'high'
    WHEN LOWER(TRIM("severity")) = 'medium' THEN 'medium'
    ELSE 'low'
  END,
  "triageStatus" = CASE
    WHEN LOWER(TRIM("status")) = 'resolved' THEN 'closed'
    WHEN "acknowledgedAt" IS NOT NULL OR "assigneeUserId" IS NOT NULL THEN 'triaged'
    ELSE 'pending'
  END,
  "priorityScore" = CASE
    WHEN LOWER(TRIM("severity")) = 'critical' THEN 95
    WHEN LOWER(TRIM("severity")) = 'high' THEN 78
    WHEN LOWER(TRIM("severity")) = 'medium' THEN 55
    ELSE 25
  END + CASE WHEN "assigneeUserId" IS NULL THEN 5 ELSE 0 END,
  "firstResponseDueAt" = COALESCE("createdAt" + INTERVAL '30 minutes', CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
  "resolveDueAt" = CASE
    WHEN LOWER(TRIM("severity")) = 'critical' THEN "createdAt" + INTERVAL '60 minutes'
    WHEN LOWER(TRIM("severity")) = 'high' THEN "createdAt" + INTERVAL '120 minutes'
    WHEN LOWER(TRIM("severity")) = 'medium' THEN "createdAt" + INTERVAL '240 minutes'
    ELSE "createdAt" + INTERVAL '480 minutes'
  END,
  "lastActivityAt" = COALESCE("updatedAt", "createdAt");

UPDATE "ExceptionCase"
SET
  "breachedAt" = CURRENT_TIMESTAMP
WHERE
  LOWER(TRIM("status")) IN ('open', 'acknowledged', 'silenced')
  AND (
    ("triageStatus" = 'pending' AND "firstResponseDueAt" <= CURRENT_TIMESTAMP)
    OR "resolveDueAt" <= CURRENT_TIMESTAMP
  );

UPDATE "ExceptionCase"
SET "slaPolicyId" = (
  CASE
    WHEN LOWER(TRIM("kind")) = 'integration' AND LOWER(TRIM("severity")) = 'critical' THEN 'slapolicy_integration_critical'
    WHEN LOWER(TRIM("kind")) = 'occurrence' AND LOWER(TRIM("severity")) = 'critical' THEN 'slapolicy_occurrence_critical'
    WHEN LOWER(TRIM("kind")) = 'maintenance' AND LOWER(TRIM("severity")) = 'high' THEN 'slapolicy_maintenance_high'
    WHEN LOWER(TRIM("kind")) = 'sla' AND LOWER(TRIM("severity")) = 'high' THEN 'slapolicy_sla_high'
    WHEN LOWER(TRIM("severity")) = 'critical' THEN 'slapolicy_generic_critical'
    WHEN LOWER(TRIM("severity")) = 'high' THEN 'slapolicy_generic_high'
    WHEN LOWER(TRIM("severity")) = 'medium' THEN 'slapolicy_generic_medium'
    ELSE 'slapolicy_generic_low'
  END
)
WHERE "slaPolicyId" IS NULL;
