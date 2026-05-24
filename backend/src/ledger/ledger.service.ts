import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { randomBytes } from 'crypto';

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

  async initializeDeposit(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    let reference = '';
    let authorization_url = '';

    if (!secretKey) {
      // Mock mode for local testing if no key is provided
      reference = `mock_${randomBytes(8).toString('hex')}`;
      authorization_url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wallet/verify?reference=${reference}&mock=true`;
    } else {
      try {
        const response = await axios.post(
          'https://api.paystack.co/transaction/initialize',
          {
            email: user.email,
            amount: amount * 100, // Paystack uses kobo
            callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wallet/verify`,
          },
          {
            headers: { Authorization: `Bearer ${secretKey}` },
          }
        );
        reference = response.data.data.reference;
        authorization_url = response.data.data.authorization_url;
      } catch (error: any) {
        throw new InternalServerErrorException(
          error.response?.data?.message || 'Failed to initialize Paystack transaction'
        );
      }
    }

    // Record the pending transaction
    await this.prisma.transaction.create({
      data: {
        reference,
        status: 'PENDING',
        type: 'DEPOSIT',
        metadata: { userId, amount },
      },
    });

    return { authorization_url, reference };
  }

  async verifyDeposit(userId: string, reference: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { reference } });
    if (!transaction) throw new NotFoundException('Transaction not found');
    
    // Ensure the transaction belongs to this user
    const meta = transaction.metadata as any;
    if (meta?.userId !== userId) throw new BadRequestException('Transaction does not belong to this user');

    if (transaction.status === 'SUCCESS') {
      return { message: 'Transaction already verified and processed', success: true };
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    let isSuccess = false;
    let verifiedAmount = 0;

    if (reference.startsWith('mock_')) {
      // Mock mode verify
      isSuccess = true;
      verifiedAmount = meta.amount;
    } else {
      if (!secretKey) throw new InternalServerErrorException('Paystack Secret Key is missing');
      try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${secretKey}` },
        });
        isSuccess = response.data.data.status === 'success';
        verifiedAmount = response.data.data.amount / 100; // convert back from kobo
      } catch (error: any) {
        throw new InternalServerErrorException(
          error.response?.data?.message || 'Failed to verify transaction'
        );
      }
    }

    if (isSuccess) {
      // Process successful transaction
      const wallet = await this.getWallet(userId);
      await this.prisma.$transaction(async (tx) => {
        // Update transaction status
        const updatedTx = await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'SUCCESS' },
        });

        // Credit wallet and create ledger entry
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: Number(wallet.availableBalance) + verifiedAmount,
            ledgerEntries: {
              create: {
                transactionId: updatedTx.id,
                amount: verifiedAmount,
                type: 'DEPOSIT',
                description: 'Paystack Deposit',
              },
            },
          },
        });
      });

      return { message: 'Deposit successful', success: true, amount: verifiedAmount };
    } else {
      // Transaction failed on Paystack side
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return { message: 'Deposit failed or pending', success: false };
    }
  }

  async processWithdrawal(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { userId } });
    if (!bankAccount) {
      throw new BadRequestException('Please link a bank account before withdrawing');
    }

    const wallet = await this.getWallet(userId);

    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException('Insufficient available balance');
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new InternalServerErrorException('Paystack Secret Key is missing');
    }

    let recipientCode = '';
    try {
      const recipientResponse = await axios.post(
        'https://api.paystack.co/transferrecipient',
        {
          type: 'nuban',
          name: bankAccount.accountName,
          account_number: bankAccount.accountNumber,
          bank_code: bankAccount.bankCode,
          currency: 'NGN',
        },
        {
          headers: { Authorization: `Bearer ${secretKey}` },
        }
      );
      
      recipientCode = recipientResponse.data.data.recipient_code;
    } catch (error: any) {
      throw new BadRequestException(
        error.response?.data?.message || 'Could not verify recipient with Paystack'
      );
    }

    let transferData;
    try {
      const transferResponse = await axios.post(
        'https://api.paystack.co/transfer',
        {
          source: 'balance',
          amount: amount * 100, // Paystack uses kobo
          recipient: recipientCode,
          reason: 'Withdrawal from Vouchit',
        },
        {
          headers: { Authorization: `Bearer ${secretKey}` },
        }
      );
      transferData = transferResponse.data.data;
    } catch (error: any) {
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to initiate transfer via Paystack'
      );
    }

    const updatedWallet = await this.prisma.$transaction(async (tx) => {
      // Create Transaction
      const transaction = await tx.transaction.create({
        data: {
          reference: transferData.reference,
          status: transferData.status === 'success' ? 'SUCCESS' : 'PENDING',
          type: 'WITHDRAWAL',
          metadata: { userId, amount, transferCode: transferData.transfer_code },
        },
      });

      // Debit wallet and create ledger entry
      const walletRecord = await tx.wallet.update({
        where: { userId },
        data: {
          availableBalance: Number(wallet.availableBalance) - amount,
          ledgerEntries: {
            create: {
              transactionId: transaction.id,
              amount: -amount,
              type: 'WITHDRAWAL',
              description: 'Bank Transfer Withdrawal',
            },
          },
        },
        include: { ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      return walletRecord;
    });

    return updatedWallet;
  }

  async resolveBankAccount(accountNumber: string, bankCode: string) {
    if (!accountNumber || accountNumber.length !== 10) {
      throw new BadRequestException('Account number must be 10 digits');
    }
    if (!bankCode) {
      throw new BadRequestException('Bank code is required');
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      // Mock mode
      if (accountNumber === '0123456789') {
        return { accountName: 'Vouchit Test Account', accountNumber, bankCode };
      }
      return { accountName: 'Demola Oladele', accountNumber, bankCode };
    }

    try {
      const response = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: { Authorization: `Bearer ${secretKey}` },
        }
      );
      return {
        accountName: response.data.data.account_name,
        accountNumber,
        bankCode,
      };
    } catch (error: any) {
      throw new BadRequestException(
        error.response?.data?.message || 'Could not resolve bank account details. Check number and bank.'
      );
    }
  }

  async getBankAccount(userId: string) {
    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { userId } });
    if (!bankAccount) return null;
    return bankAccount;
  }

  async linkBankAccount(userId: string, data: { bankCode: string, bankName: string, accountNumber: string, accountName: string }) {
    // Upsert so if they link a new one, it overrides the old one
    const bankAccount = await this.prisma.bankAccount.upsert({
      where: { userId },
      update: {
        bankCode: data.bankCode,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
      },
      create: {
        userId,
        bankCode: data.bankCode,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
      }
    });
    return bankAccount;
  }

  async unlinkBankAccount(userId: string) {
    try {
      await this.prisma.bankAccount.delete({ where: { userId } });
    } catch (e) {
      // Ignore if doesn't exist
    }
    return { success: true };
  }
}
