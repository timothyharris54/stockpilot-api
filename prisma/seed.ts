import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const account = await prisma.account.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      name: 'Local Demo Account',
    },
  });

  await prisma.user.upsert({
    where: {
      accountId_email: {
        accountId: account.id,
        email: 'timothy.harris54@gmail.com',
      },
    },
    update: {},
    create: {
      accountId: account.id,
      email: 'timothy.harris54@gmail.com',
      fullName: 'Timothy Harris',
    },
  });

  console.log('Seed complete');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });