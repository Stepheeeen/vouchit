import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DisputesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createDispute(
    wagerId: string,
    userId: string,
    reason: string,
    proofType?: string,
    mediaUrl?: string,
  ) {
    // Verify wager exists and user is a participant
    const wager = await this.prisma.wager.findUnique({
      where: { id: wagerId },
      include: { participants: true, dispute: true },
    });
    if (!wager) throw new NotFoundException('Wager not found');

    const isParticipant = wager.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new BadRequestException('You are not a participant in this wager');
    }

    if (wager.status !== 'ACTIVE' && wager.status !== 'DISPUTED') {
      throw new BadRequestException('Disputes can only be opened on active or disputed wagers');
    }

    // Create or find dispute
    let dispute = wager.dispute;
    if (!dispute) {
      dispute = await this.prisma.dispute.create({
        data: {
          wagerId,
          status: 'OPEN',
        },
      });
    }

    // Add evidence
    const evidence = await this.prisma.evidence.create({
      data: {
        disputeId: dispute.id,
        userId,
        textClaim: reason,
        proofType: proofType || null,
        mediaUrl: mediaUrl || null,
      },
    });

    // Update wager status to DISPUTED
    await this.prisma.wager.update({
      where: { id: wagerId },
      data: { status: 'DISPUTED' },
    });

    return {
      dispute,
      evidence,
      message: 'Dispute filed successfully. Our team will review within 24 hours.',
    };
  }

  async getDispute(wagerId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { wagerId },
      include: {
        evidence: { include: { user: true } },
        wager: { include: { creator: true, participants: { include: { user: true } } } },
      },
    });
    if (!dispute) throw new NotFoundException('No dispute found for this wager');
    return dispute;
  }

  async getAllDisputes() {
    return this.prisma.dispute.findMany({
      include: {
        evidence: { include: { user: true } },
        wager: { include: { creator: true, participants: { include: { user: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveDispute(
    disputeId: string,
    resolution: 'WINNER_A' | 'WINNER_B' | 'REFUND',
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        wager: {
          include: {
            participants: { include: { user: true } },
          },
        },
      },
    });

    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status !== 'OPEN') {
      throw new BadRequestException('Dispute is already resolved');
    }

    const wager = dispute.wager;
    if (!wager) throw new NotFoundException('Wager not found for this dispute');

    const FEE_RATE = 0.025; // 2.5%
    const pot = Number(wager.totalPot);

    if (resolution === 'REFUND') {
      // Refund both parties
      await this.prisma.$transaction(async (tx) => {
        for (const p of wager.participants) {
          const wallet = await tx.wallet.findUnique({ where: { userId: p.userId } });
          if (wallet) {
            await tx.wallet.update({
              where: { userId: p.userId },
              data: {
                availableBalance: Number(wallet.availableBalance) + Number(p.amount),
                escrowBalance: Math.max(0, Number(wallet.escrowBalance) - Number(p.amount)),
                ledgerEntries: {
                  create: {
                    amount: p.amount,
                    type: 'ESCROW_RELEASE',
                    description: `Refund from resolved dispute: ${wager.description.slice(0, 40)}`,
                  },
                },
              },
            });
          }
          await tx.wagerParticipant.update({
            where: { id: p.id },
            data: { status: 'REFUNDED' },
          });
        }

        // Update wager to CANCELLED
        await tx.wager.update({
          where: { id: wager.id },
          data: { status: 'CANCELLED' },
        });

        // Update dispute status
        await tx.dispute.update({
          where: { id: disputeId },
          data: { status: 'RESOLVED', resolution: 'REFUND' },
        });
      });

      // Send notifications
      try {
        for (const p of wager.participants) {
          await this.notificationsService.createNotification(
            p.userId,
            'DISPUTE_RESOLVED',
            `Dispute for wager "${wager.description.slice(0, 40)}" has been resolved. Both parties have been refunded.`,
          );
        }
      } catch (err) {
        console.error('Failed to send dispute notifications:', err);
      }

      return { status: 'RESOLVED', resolution: 'REFUND', message: 'Dispute resolved. Refund processed successfully.' };
    } else {
      // Settle for Winner A (Creator) or Winner B (Challenger)
      const creatorParticipant = wager.participants.find(p => p.side === 'CREATOR');
      const challengerParticipant = wager.participants.find(p => p.side === 'CHALLENGER');

      const winnerParticipant = resolution === 'WINNER_A' ? creatorParticipant : challengerParticipant;
      if (!winnerParticipant) {
        throw new BadRequestException('Winner participant not found');
      }
      
      const winnerUserId = winnerParticipant.userId;
      const fee = pot * FEE_RATE;
      const payout = pot - fee;

      await this.prisma.$transaction(async (tx) => {
        // Credit winner's available balance and reduce escrow
        const winnerWallet = await tx.wallet.findUnique({ where: { userId: winnerUserId } });
        if (winnerWallet) {
          await tx.wallet.update({
            where: { userId: winnerUserId },
            data: {
              availableBalance: Number(winnerWallet.availableBalance) + payout,
              escrowBalance: Math.max(0, Number(winnerWallet.escrowBalance) - Number(winnerParticipant.amount)),
              ledgerEntries: {
                create: {
                  amount: payout,
                  type: 'WIN',
                  description: `Won wager (Dispute resolved): ${wager.description.slice(0, 40)}`,
                },
              },
            },
          });
        }

        // Deduct escrow from other participants (losers)
        for (const p of wager.participants) {
          if (p.userId !== winnerUserId) {
            const loserWallet = await tx.wallet.findUnique({ where: { userId: p.userId } });
            if (loserWallet) {
              await tx.wallet.update({
                where: { userId: p.userId },
                data: {
                  escrowBalance: Math.max(0, Number(loserWallet.escrowBalance) - Number(p.amount)),
                  ledgerEntries: {
                    create: {
                      amount: -Number(p.amount),
                      type: 'ESCROW_RELEASE',
                      description: `Lost wager (Dispute resolved): ${wager.description.slice(0, 40)}`,
                    },
                  },
                },
              });
            }
          }
        }

        // Update wager to SETTLED
        await tx.wager.update({
          where: { id: wager.id },
          data: { status: 'SETTLED', winnerId: winnerUserId },
        });

        // Update dispute to RESOLVED
        await tx.dispute.update({
          where: { id: disputeId },
          data: { status: 'RESOLVED', resolution },
        });
      });

      // Send notifications
      try {
        const winnerName = winnerParticipant.user?.displayName || winnerParticipant.user?.email.split('@')[0] || 'Winner';
        for (const p of wager.participants) {
          const isWinner = p.userId === winnerUserId;
          const msg = isWinner
            ? `Dispute resolved! You won the wager: "${wager.description.slice(0, 40)}" and received a payout of ₦${payout.toLocaleString()} (after 2.5% fee).`
            : `Dispute resolved for wager: "${wager.description.slice(0, 40)}". Winner: ${winnerName}.`;

          await this.notificationsService.createNotification(
            p.userId,
            'DISPUTE_RESOLVED',
            msg,
          );
        }
      } catch (err) {
        console.error('Failed to send dispute notifications:', err);
      }

      return { status: 'RESOLVED', resolution, winnerId: winnerUserId, message: `Dispute resolved. Payout to winner processed successfully.` };
    }
  }
}
