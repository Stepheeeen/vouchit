import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      include: {
        wallet: true,
      }
    });
    console.log('Users:');
    console.dir(users, { depth: null });
  } catch (error) {
    console.error('Error reading users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
