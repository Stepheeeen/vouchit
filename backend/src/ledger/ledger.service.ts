import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 20 } }
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async simulateDeposit(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const wallet = await this.getWallet(userId);

    const updatedWallet = await this.prisma.wallet.update({
      where: { userId },
      data: {
        availableBalance: Number(wallet.availableBalance) + amount,
        ledgerEntries: {
          create: {
            amount,
            type: 'DEPOSIT',
            description: 'Simulated Paystack Deposit'
          }
        }
      },
      include: { ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    return updatedWallet;
  }

  async simulateWithdrawal(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const wallet = await this.getWallet(userId);

    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException('Insufficient available balance');
    }

    const updatedWallet = await this.prisma.wallet.update({
      where: { userId },
      data: {
        availableBalance: Number(wallet.availableBalance) - amount,
        ledgerEntries: {
          create: {
            amount: -amount,
            type: 'WITHDRAWAL',
            description: 'Simulated Bank Withdrawal'
          }
        }
      },
      include: { ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    return updatedWallet;
  }
}
