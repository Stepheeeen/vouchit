import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Attempting to connect to the database...');
  try {
    const usersCount = await prisma.user.count();
    console.log('Connection successful!');
    console.log('Total users in DB:', usersCount);
  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
