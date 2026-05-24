import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const FEE_RATE = 0.025; // 2.5%

@Injectable()
export class WagersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async checkAndProcessExpiredWagers() {
    const now = new Date();
    const expiredWagers = await this.prisma.wager.findMany({
      where: {
        status: 'PENDING_FUNDING',
        expiresAt: { lt: now },
      },
      include: {
        participants: true,
      },
    });

    for (const wager of expiredWagers) {
      const creatorParticipant = wager.participants.find(p => p.side === 'CREATOR');
      if (creatorParticipant && creatorParticipant.status === 'FUNDED') {
        const creatorId = wager.creatorId;
        const refundAmount = creatorParticipant.amount;

        try {
          await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({ where: { userId: creatorId } });
            if (wallet) {
              await tx.wallet.update({
                where: { userId: creatorId },
                data: {
                  availableBalance: Number(wallet.availableBalance) + refundAmount,
                  escrowBalance: Math.max(0, Number(wallet.escrowBalance) - refundAmount),
                  ledgerEntries: {
                    create: {
                      amount: refundAmount,
                      type: 'ESCROW_RELEASE',
                      description: `Refund for expired wager: ${wager.description.slice(0, 40)}`,
                    },
                  },
                },
              });
            }

            await tx.wagerParticipant.update({
              where: { id: creatorParticipant.id },
              data: { status: 'REFUNDED' },
            });

            await tx.wager.update({
              where: { id: wager.id },
              data: { status: 'EXPIRED' },
            });
          });
        } catch (error) {
          console.error(`Failed to process refund for expired wager ${wager.id}:`, error);
        }
      }
    }
  }

  async createWager(userId: string, description: string, amount: number, isSymmetric?: boolean, expiryDays?: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    // Check wallet balance
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException('Wallet not found');
    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException('Insufficient balance. Please fund your wallet first.');
    }

    // Deduct from available, add to escrow, create ledger entry
    await this.prisma.wallet.update({
      where: { userId },
      data: {
        availableBalance: Number(wallet.availableBalance) - amount,
        escrowBalance: Number(wallet.escrowBalance) + amount,
        ledgerEntries: {
          create: {
            amount: -amount,
            type: 'ESCROW_LOCK',
            description: `Stake locked for wager: ${description.slice(0, 40)}`,
          },
        },
      },
    });

    const days = expiryDays && [1, 3, 7, 30].includes(expiryDays) ? expiryDays : 1;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const wager = await this.prisma.wager.create({
      data: {
        creatorId: userId,
        description,
        totalPot: amount,
        status: 'PENDING_FUNDING',
        isSymmetric: isSymmetric !== false,
        expiresAt,
        participants: {
          create: {
            userId,
            side: 'CREATOR',
            amount,
            status: 'FUNDED',
          },
        },
      },
      include: { participants: true, creator: true },
    });

    try {
      await this.notificationsService.createNotification(
        userId,
        'WAGER_CREATED',
        `You successfully created a wager: "${description.slice(0, 40)}${description.length > 40 ? '...' : ''}" with a stake of ₦${amount.toLocaleString()}.`
      );
    } catch (err) {
      console.error('Failed to create notification:', err);
    }

    return wager;
  }

  async findAll() {
    await this.checkAndProcessExpiredWagers();
    return this.prisma.wager.findMany({
      where: { status: { in: ['PENDING_FUNDING', 'ACTIVE'] } },
      include: { creator: true, participants: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    await this.checkAndProcessExpiredWagers();
    const wager = await this.prisma.wager.findUnique({
      where: { id },
      include: {
        creator: true,
        participants: { include: { user: true } },
        dispute: true,
      },
    });
    if (!wager) throw new NotFoundException('Wager not found');
    return wager;
  }

  async getUserWagers(userId: string) {
    await this.checkAndProcessExpiredWagers();
    return this.prisma.wager.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: {
        creator: true,
        participants: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async joinWager(wagerId: string, userId: string, amount: number) {
    const wager = await this.findOne(wagerId);

    if (wager.creatorId === userId) {
      throw new BadRequestException('Creator cannot join their own wager');
    }
    if (wager.participants.length >= 2) {
      throw new BadRequestException('Wager already has two participants');
    }
    if (wager.status !== 'PENDING_FUNDING') {
      throw new BadRequestException('This wager is no longer open to join');
    }

    const creatorParticipant = wager.participants.find((p) => p.side === 'CREATOR');
    if (wager.isSymmetric && creatorParticipant && creatorParticipant.amount !== amount) {
      throw new BadRequestException(`This wager is symmetric. You must match the creator's stake of ₦${creatorParticipant.amount.toLocaleString()}`);
    }

    // Check wallet balance
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException('Wallet not found');
    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException('Insufficient balance. Please fund your wallet first.');
    }

    // Deduct from challenger's wallet into escrow
    await this.prisma.wallet.update({
      where: { userId },
      data: {
        availableBalance: Number(wallet.availableBalance) - amount,
        escrowBalance: Number(wallet.escrowBalance) + amount,
        ledgerEntries: {
          create: {
            amount: -amount,
            type: 'ESCROW_LOCK',
            description: `Stake locked for wager: ${wager.description.slice(0, 40)}`,
          },
        },
      },
    });

    // Add participant
    await this.prisma.wagerParticipant.create({
      data: {
        wagerId,
        userId,
        side: 'CHALLENGER',
        amount,
        status: 'FUNDED',
      },
    });

    // Update wager
    const updated = await this.prisma.wager.update({
      where: { id: wagerId },
      data: {
        totalPot: Number(wager.totalPot) + amount,
        status: 'ACTIVE',
      },
      include: { participants: { include: { user: true } }, creator: true },
    });

    try {
      const challengerUser = await this.prisma.user.findUnique({ where: { id: userId } });
      const challengerName = challengerUser?.displayName || challengerUser?.email.split('@')[0] || 'An opponent';
      const creatorName = wager.creator.displayName || wager.creator.email.split('@')[0] || 'Creator';

      await this.notificationsService.createNotification(
        wager.creatorId,
        'WAGER_JOINED',
        `${challengerName} has accepted and joined your wager: "${wager.description.slice(0, 40)}${wager.description.length > 40 ? '...' : ''}".`
      );

      await this.notificationsService.createNotification(
        userId,
        'WAGER_JOINED',
        `You successfully joined the wager created by ${creatorName}: "${wager.description.slice(0, 40)}${wager.description.length > 40 ? '...' : ''}".`
      );
    } catch (err) {
      console.error('Failed to create notifications for joinWager:', err);
    }

    return updated;
  }

  async settleWager(wagerId: string, userId: string, winnerId: string) {
    const wager = await this.findOne(wagerId);

    if (wager.status !== 'ACTIVE') {
      throw new BadRequestException('This wager is not active');
    }

    // Verify userId is a participant
    const participant = wager.participants.find((p) => p.userId === userId);
    if (!participant) {
      throw new BadRequestException('You are not a participant in this wager');
    }

    // Verify winnerId is a participant
    const winnerParticipant = wager.participants.find((p) => p.userId === winnerId);
    if (!winnerParticipant) {
      throw new BadRequestException('Winner must be a participant of this wager');
    }

    // Record this participant's settle vote
    await this.prisma.wagerParticipant.update({
      where: { wagerId_userId: { wagerId, userId } },
      data: { settleVote: winnerId },
    });

    // Re-fetch to check if both have voted
    const updatedParticipants = await this.prisma.wagerParticipant.findMany({
      where: { wagerId },
    });

    const bothVoted = updatedParticipants.every((p) => p.settleVote !== null);

    if (bothVoted) {
      const votes = updatedParticipants.map((p) => p.settleVote);
      const allAgree = votes.every((v) => v === votes[0]);

      if (allAgree) {
        // ✅ Unanimous — settle the wager
        return await this._executeSettlement(wager, votes[0]!);
      } else {
        // ❌ Disagreement — auto-open dispute
        await this.prisma.wager.update({
          where: { id: wagerId },
          data: { status: 'DISPUTED' },
        });
        // Create dispute if it doesn't exist
        const existing = await this.prisma.dispute.findUnique({ where: { wagerId } });
        if (!existing) {
          await this.prisma.dispute.create({
            data: { wagerId, status: 'OPEN' },
          });
        }

        try {
          for (const p of wager.participants) {
            await this.notificationsService.createNotification(
              p.userId,
              'DISPUTE_OPENED',
              `A dispute has been automatically opened for the wager: "${wager.description.slice(0, 40)}${wager.description.length > 40 ? '...' : ''}" due to conflicting votes.`
            );
          }
        } catch (err) {
          console.error('Failed to send dispute notifications:', err);
        }

        return { status: 'DISPUTED', message: 'Participants disagree — dispute opened automatically.' };
      }
    }

    return {
      status: 'VOTE_RECORDED',
      message: 'Your vote has been recorded. Waiting for opponent to confirm.',
    };
  }

  private async _executeSettlement(wager: any, winnerUserId: string) {
    const pot = Number(wager.totalPot);
    const fee = pot * FEE_RATE;
    const payout = pot - fee;

    const settled = await this.prisma.$transaction(async (tx) => {
      // Credit winner's available balance
      const winnerWallet = await tx.wallet.findUnique({ where: { userId: winnerUserId } });
      if (winnerWallet) {
        await tx.wallet.update({
          where: { userId: winnerUserId },
          data: {
            availableBalance: Number(winnerWallet.availableBalance) + payout,
            escrowBalance: Math.max(0, Number(winnerWallet.escrowBalance) - Number(wager.participants.find((p: any) => p.userId === winnerUserId)?.amount || 0)),
            ledgerEntries: {
              create: {
                amount: payout,
                type: 'WIN',
                description: `Won wager: ${wager.description.slice(0, 40)}`,
              },
            },
          },
        });
      }

      // Deduct escrow from loser(s)
      for (const participant of wager.participants) {
        if (participant.userId !== winnerUserId) {
          const loserWallet = await tx.wallet.findUnique({ where: { userId: participant.userId } });
          if (loserWallet) {
            await tx.wallet.update({
              where: { userId: participant.userId },
              data: {
                escrowBalance: Math.max(0, Number(loserWallet.escrowBalance) - Number(participant.amount)),
                ledgerEntries: {
                  create: {
                    amount: -Number(participant.amount),
                    type: 'ESCROW_RELEASE',
                    description: `Lost wager: ${wager.description.slice(0, 40)}`,
                  },
                },
              },
            });
          }
        }
      }

      // Update all participant statuses
      await tx.wagerParticipant.updateMany({
        where: { wagerId: wager.id },
        data: { status: 'FUNDED' },
      });

      // Update wager to settled
      const settled = await tx.wager.update({
        where: { id: wager.id },
        data: {
          status: 'SETTLED',
          winnerId: winnerUserId,
        },
        include: { participants: { include: { user: true } }, creator: true },
      });

      return settled;
    });

    try {
      const pot = Number(wager.totalPot);
      const fee = pot * FEE_RATE;
      const payout = pot - fee;

      const winnerParticipant = settled.participants.find((p: any) => p.userId === winnerUserId);
      const winnerName = winnerParticipant?.user.displayName || winnerParticipant?.user.email.split('@')[0] || 'Winner';

      for (const p of settled.participants) {
        const isWinner = p.userId === winnerUserId;
        const msg = isWinner 
          ? `Congratulations! You won the wager: "${wager.description.slice(0, 40)}${wager.description.length > 40 ? '...' : ''}" and received payout of ₦${payout.toLocaleString()} (after 2.5% fee).`
          : `Wager settled: "${wager.description.slice(0, 40)}${wager.description.length > 40 ? '...' : ''}". Winner: ${winnerName}.`;

        await this.notificationsService.createNotification(
          p.userId,
          'SETTLEMENT',
          msg
        );
      }
    } catch (err) {
      console.error('Failed to send settlement notifications:', err);
    }

    return settled;
  }
}
