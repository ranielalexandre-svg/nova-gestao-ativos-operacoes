import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@nova.local").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "Nova123456";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Admin NOVA",
      role: "admin",
      passwordHash: adminPasswordHash,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: "Admin NOVA",
      role: "admin",
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  const partner = await prisma.partner.upsert({
    where: { code: "PMG" },
    update: {
      name: "Parceiro Exemplo PMG",
      isActive: true,
    },
    create: {
      code: "PMG",
      name: "Parceiro Exemplo PMG",
      isActive: true,
    },
  });

  const unit = await prisma.unit.upsert({
    where: { code: "PMG-CENTRAL" },
    update: {
      name: "Unidade Central PMG",
      city: "Palmas",
      state: "TO",
      isActive: true,
      partnerId: partner.id,
    },
    create: {
      code: "PMG-CENTRAL",
      name: "Unidade Central PMG",
      city: "Palmas",
      state: "TO",
      isActive: true,
      partnerId: partner.id,
    },
  });

  await prisma.equipment.upsert({
    where: { tag: "EQ-PMG-001" },
    update: {
      name: "Switch Core PMG",
      type: "switch",
      status: "active",
      isActive: true,
      unitId: unit.id,
    },
    create: {
      tag: "EQ-PMG-001",
      name: "Switch Core PMG",
      type: "switch",
      status: "active",
      isActive: true,
      unitId: unit.id,
    },
  });

  console.log("seed ok");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
