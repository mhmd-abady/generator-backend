import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  // Admin credentials
  const username = 'admin';
  const email = 'admin@example.com';
  const rawPassword = 'admin123';
  const password = await argon2.hash(rawPassword);

  await prisma.user.upsert({
    where: { username },
    update: { email, password, role: 'ADMIN' },
    create: {
      username,
      email,
      password,
      role: 'ADMIN',
    },
  });

  console.log(`Seed complete. Admin user: ${username} / ${rawPassword}`);
}

main()
  .catch((e) => {
  console.error(e);
  process.exit(1);
})
.finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
