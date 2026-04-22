import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@nova.local';
  const password = process.env.ADMIN_PASSWORD || 'Nova123456';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Admin NOVA',
      role: 'admin',
      passwordHash,
      isActive: true,
    },
    create: {
      email,
      name: 'Admin NOVA',
      role: 'admin',
      passwordHash,
      isActive: true,
    },
  });

  console.log(`seed ok: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
