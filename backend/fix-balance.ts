import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const simulatedEntries = await prisma.ledgerEntry.findMany({
    where: { description: 'Simulated Bank Withdrawal' }
  });
  
  for (const entry of simulatedEntries) {
    const amount = Math.abs(entry.amount);
    
    // Check if we already reversed it
    const alreadyReversed = await prisma.ledgerEntry.findFirst({
      where: { walletId: entry.walletId, description: 'Reversal of Simulated Withdrawal' }
    });
    
    if (!alreadyReversed) {
      await prisma.wallet.update({
        where: { id: entry.walletId },
        data: {
          availableBalance: { increment: amount },
          ledgerEntries: {
            create: {
              amount: amount,
              type: 'DEPOSIT',
              description: 'Reversal of Simulated Withdrawal'
            }
          }
        }
      });
      console.log(`Reversed ${amount} for wallet ${entry.walletId}`);
    } else {
      console.log(`Already reversed for wallet ${entry.walletId}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
