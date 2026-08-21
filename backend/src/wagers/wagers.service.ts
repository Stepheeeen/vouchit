import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Web3Service } from '../web3/web3.service';
import { findToken, parseTokenAmount } from '../web3/tokens';

const FEE_RATE = 0.025; // 2.5%

@Injectable()
export class WagersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private web3Service: Web3Service,
  ) {}

  /**
   * Mirror expiry into our records. The refund itself is on-chain: the creator
   * (or anyone) calls `cancelExpiredWager` on the escrow, which returns the
   * stake. We never move funds here — we don't hold them.
   */
  async checkAndProcessExpiredWagers() {
    const now = new Date();
    const expiredWagers = await this.prisma.wager.findMany({
      where: { status: 'PENDING_FUNDING', expiresAt: { lt: now } },
      include: { participants: true },
    });

    for (const wager of expiredWagers) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.wagerParticipant.updateMany({
            where: { wagerId: wager.id, status: 'FUNDED' },
            data: { status: 'REFUNDABLE' },
          });
          await tx.wager.update({ where: { id: wager.id }, data: { status: 'EXPIRED' } });
        });

        await this.notificationsService.createNotification(
          wager.creatorId,
          'WAGER_EXPIRED',
          `Nobody joined "${wager.description.slice(0, 40)}". Your stake is unlocked — claim the refund from the wager page.`,
        );
      } catch (error) {
        console.error(`Failed to mark wager ${wager.id} expired:`, error);
      }
    }
  }

  async createWager(
    userId: string,
    description: string,
    stake: string,
    tokenAddress: string,
    contractWagerId: string,
    isSymmetric?: boolean,
    expiryDays?: number,
  ) {
    const token = findToken(tokenAddress);
    if (!token) {
      throw new BadRequestException('Unsupported stake currency');
    }

    let stakeAmount: bigint;
    try {
      stakeAmount = parseTokenAmount(stake, token.decimals);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
    if (stakeAmount < token.minStake) {
      throw new BadRequestException(`Stake is below the ${token.symbol} minimum`);
    }

    // Stakes live in the escrow contract, never in our ledger, so the id must be
    // proven against the chain before the wager exists here. verifyOnChainWager
    // checks the escrow entry exists, was created by this user's linked wallet,
    // is still open, and holds exactly the stake being claimed.
    const onChain = await this.web3Service.verifyOnChainWager(userId, contractWagerId, stakeAmount);
    if (onChain.token.toLowerCase() !== token.address) {
      throw new BadRequestException('On-chain stake token does not match the submitted currency');
    }

    const days = expiryDays && [1, 3, 7, 30].includes(expiryDays) ? expiryDays : 1;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const wager = await this.prisma.wager.create({
      data: {
        creatorId: userId,
        description,
        // Only the creator has staked so far; the challenger's match doubles it.
        totalPot: stakeAmount.toString(),
        status: 'PENDING_FUNDING',
        isSymmetric: isSymmetric !== false,
        contractWagerId,
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        tokenDecimals: token.decimals,
        onChainStake: stakeAmount.toString(),
        expiresAt,
        participants: {
          create: {
            userId,
            side: 'CREATOR',
            amount: stakeAmount.toString(),
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
        `You successfully created a wager: "${description.slice(0, 40)}${description.length > 40 ? '...' : ''}" with a stake of ${stake} ${token.symbol}.`
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

  /**
   * Record a join that has already happened on-chain. The challenger escrows
   * their stake by calling `joinWager` on the escrow contract; this only mirrors
   * the result after verifying it against the chain. No funds move here.
   */
  async joinWager(wagerId: string, userId: string) {
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
    if (!wager.contractWagerId) {
      throw new BadRequestException('This wager has no escrow entry');
    }

    const onChain = await this.web3Service.verifyOnChainJoin(userId, wager.contractWagerId);

    await this.prisma.wagerParticipant.create({
      data: {
        wagerId,
        userId,
        side: 'CHALLENGER',
        amount: onChain.stakeAmount.toString(),
        status: 'FUNDED',
      },
    });

    const updated = await this.prisma.wager.update({
      where: { id: wagerId },
      data: {
        // Trust the contract's own accounting rather than adding locally.
        totalPot: onChain.totalPot.toString(),
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
