-- CreateTable
CREATE TABLE "Responsibility" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT,
    "unitId" TEXT,
    "equipmentId" TEXT,
    "occurrenceId" TEXT,
    "maintenanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftHandoff" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shiftLabel" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdById" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEntry" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT,
    "userId" TEXT,
    "handoffId" TEXT,
    "partnerId" TEXT,
    "unitId" TEXT,
    "equipmentId" TEXT,
    "occurrenceId" TEXT,
    "maintenanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Responsibility_userId_idx" ON "Responsibility"("userId");

-- CreateIndex
CREATE INDEX "Responsibility_partnerId_idx" ON "Responsibility"("partnerId");

-- CreateIndex
CREATE INDEX "Responsibility_unitId_idx" ON "Responsibility"("unitId");

-- CreateIndex
CREATE INDEX "Responsibility_equipmentId_idx" ON "Responsibility"("equipmentId");

-- CreateIndex
CREATE INDEX "Responsibility_occurrenceId_idx" ON "Responsibility"("occurrenceId");

-- CreateIndex
CREATE INDEX "Responsibility_maintenanceId_idx" ON "Responsibility"("maintenanceId");

-- CreateIndex
CREATE INDEX "Responsibility_role_idx" ON "Responsibility"("role");

-- CreateIndex
CREATE INDEX "Responsibility_isActive_idx" ON "Responsibility"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftHandoff_code_key" ON "ShiftHandoff"("code");

-- CreateIndex
CREATE INDEX "ShiftHandoff_status_idx" ON "ShiftHandoff"("status");

-- CreateIndex
CREATE INDEX "ShiftHandoff_shiftLabel_idx" ON "ShiftHandoff"("shiftLabel");

-- CreateIndex
CREATE INDEX "ShiftHandoff_createdById_idx" ON "ShiftHandoff"("createdById");

-- CreateIndex
CREATE INDEX "ShiftHandoff_closedById_idx" ON "ShiftHandoff"("closedById");

-- CreateIndex
CREATE INDEX "ActivityEntry_kind_idx" ON "ActivityEntry"("kind");

-- CreateIndex
CREATE INDEX "ActivityEntry_severity_idx" ON "ActivityEntry"("severity");

-- CreateIndex
CREATE INDEX "ActivityEntry_userId_idx" ON "ActivityEntry"("userId");

-- CreateIndex
CREATE INDEX "ActivityEntry_handoffId_idx" ON "ActivityEntry"("handoffId");

-- CreateIndex
CREATE INDEX "ActivityEntry_partnerId_idx" ON "ActivityEntry"("partnerId");

-- CreateIndex
CREATE INDEX "ActivityEntry_unitId_idx" ON "ActivityEntry"("unitId");

-- CreateIndex
CREATE INDEX "ActivityEntry_equipmentId_idx" ON "ActivityEntry"("equipmentId");

-- CreateIndex
CREATE INDEX "ActivityEntry_occurrenceId_idx" ON "ActivityEntry"("occurrenceId");

-- CreateIndex
CREATE INDEX "ActivityEntry_maintenanceId_idx" ON "ActivityEntry"("maintenanceId");

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsibility" ADD CONSTRAINT "Responsibility_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "Maintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandoff" ADD CONSTRAINT "ShiftHandoff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandoff" ADD CONSTRAINT "ShiftHandoff_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "ShiftHandoff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "Maintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
