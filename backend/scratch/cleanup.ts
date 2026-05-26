import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'test-reg-unique@flairtechlabs.co' },
      include: { wallet: true }
    });
    if (user) {
      if (user.wallet) {
        await prisma.wallet.delete({ where: { id: user.wallet.id } });
        console.log('Wallet deleted.');
      }
      await prisma.user.delete({ where: { id: user.id } });
      console.log('User deleted.');
    } else {
      console.log('User not found.');
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
