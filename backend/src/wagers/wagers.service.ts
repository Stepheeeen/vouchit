import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Web3Service } from '../web3/web3.service';
import { findToken, parseTokenAmount, NATIVE_TOKEN_ADDRESS as ZERO_ADDRESS } from '../web3/tokens';
import { OnChainWagerStatus } from '../web3/escrow.abi';
import { VerificationService, TIER_LIMITS } from '../web3/verification.service';
import { formatTokenAmount } from '../web3/tokens';

@Injectable()
export class WagersService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private web3Service: Web3Service,
    private verificationService: VerificationService,
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

    // Tier gates: bound how much damage a fresh account can do. These limit
    // stake size and concurrency, not withdrawals — we hold no funds.
    const { tier, limits } = await this.verificationService.refreshTier(userId);

    const maxStake = token.tierMaxStake[tier] ?? null;
    if (maxStake !== null && stakeAmount > maxStake) {
      throw new BadRequestException(
        `Your current tier allows stakes up to ${formatTokenAmount(maxStake, token.decimals)} ${token.symbol}. Verify your wallet to raise this limit.`,
      );
    }

    const openWagers = await this.prisma.wager.count({
      where: {
        participants: { some: { userId } },
        status: { in: ['PENDING_FUNDING', 'ACTIVE', 'DISPUTED'] },
      },
    });
    if (openWagers >= limits.maxConcurrentWagers) {
      throw new BadRequestException(
        `Your current tier allows ${limits.maxConcurrentWagers} open wagers at a time. Settle one before creating another.`,
      );
    }

    // Stakes live in the escrow contract, never in our ledger, so the id must be
    // proven against the chain before the wager exists here. verifyOnChainWager
    // checks the escrow entry exists, was created by this user's linked wallet,
    // is still open, and holds exactly the stake being claimed.
    const onChain = await this.web3Service.verifyOnChainWager(userId, contractWagerId, stakeAmount);
    if (onChain.token.toLowerCase() !== token.address) {
      throw new BadRequestException('On-chain stake token does not match the submitted currency');
    }

    // A zero challenger address means anyone can join. That is the riskier
    // shape, so it is gated behind the verified tier.
    const isOpenWager = onChain.challenger === '0x0000000000000000000000000000000000000000';
    if (isOpenWager && !limits.canCreateOpenWagers) {
      throw new BadRequestException(
        'Your current tier can only create wagers aimed at a specific opponent. Verify your wallet to open wagers to anyone.',
      );
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

  /**
   * Sync settlement state from the escrow contract.
   *
   * Votes are cast on-chain (`voteWinner`), and the contract settles itself the
   * moment both sides agree — it pays the winner and the treasury directly. This
   * method never decides an outcome or moves money; it reads what the chain did
   * and mirrors it, so our rows can't drift from the funds.
   */
  async settleWager(wagerId: string, userId: string) {
    const wager = await this.findOne(wagerId);

    if (!wager.contractWagerId) {
      throw new BadRequestException('This wager has no escrow entry');
    }
    if (!wager.participants.some((p: any) => p.userId === userId)) {
      throw new BadRequestException('You are not a participant in this wager');
    }

    const onChain = await this.web3Service.getOnChainWager(wager.contractWagerId);

    /** Map an on-chain address back to the participant who owns it. */
    const participantByAddress = (address: string) =>
      wager.participants.find(
        (p: any) => p.user?.web3Address && p.user.web3Address.toLowerCase() === address.toLowerCase(),
      );

    // Mirror each side's on-chain vote onto its participant row.
    const votes: Array<[string, string]> = [
      [onChain.creator, onChain.creatorVote],
      [onChain.challenger, onChain.challengerVote],
    ];
    for (const [voterAddress, votedFor] of votes) {
      if (votedFor === ZERO_ADDRESS) continue;
      const voter = participantByAddress(voterAddress);
      const votedParticipant = participantByAddress(votedFor);
      if (voter && votedParticipant && voter.settleVote !== votedParticipant.userId) {
        await this.prisma.wagerParticipant.update({
          where: { id: voter.id },
          data: { settleVote: votedParticipant.userId },
        });
      }
    }

    if (onChain.status === OnChainWagerStatus.SETTLED) {
      const winner = participantByAddress(onChain.winner);
      if (!winner) {
        throw new BadRequestException('The on-chain winner does not match any participant');
      }
      if (wager.status !== 'SETTLED') {
        await this.prisma.wager.update({
          where: { id: wagerId },
          data: { status: 'SETTLED', winnerId: winner.userId },
        });

        try {
          const winnerName =
            winner.user?.displayName || winner.user?.email.split('@')[0] || 'The winner';
          for (const p of wager.participants) {
            const msg =
              p.userId === winner.userId
                ? `You won "${wager.description.slice(0, 40)}". The escrow paid your winnings on-chain, less the 2.5% protocol fee.`
                : `"${wager.description.slice(0, 40)}" has been settled. Winner: ${winnerName}.`;
            await this.notificationsService.createNotification(p.userId, 'WAGER_SETTLED', msg);
          }
        } catch (err) {
          console.error('Failed to send settlement notifications:', err);
        }
      }
      return { status: 'SETTLED', winnerId: winner.userId, message: 'Settled on-chain.' };
    }

    if (onChain.status === OnChainWagerStatus.DISPUTED) {
      if (wager.status !== 'DISPUTED') {
        await this.prisma.wager.update({ where: { id: wagerId }, data: { status: 'DISPUTED' } });
        const existing = await this.prisma.dispute.findUnique({ where: { wagerId } });
        if (!existing) {
          await this.prisma.dispute.create({ data: { wagerId, status: 'OPEN' } });
        }
        try {
          for (const p of wager.participants) {
            await this.notificationsService.createNotification(
              p.userId,
              'DISPUTE_OPENED',
              `A dispute was opened for "${wager.description.slice(0, 40)}". An admin will review it.`,
            );
          }
        } catch (err) {
          console.error('Failed to send dispute notifications:', err);
        }
      }
      return { status: 'DISPUTED', message: 'This wager is under dispute.' };
    }

    const bothVoted = onChain.creatorVote !== ZERO_ADDRESS && onChain.challengerVote !== ZERO_ADDRESS;
    if (bothVoted && onChain.creatorVote !== onChain.challengerVote) {
      // The contract leaves conflicting votes ACTIVE — someone has to call
      // openDispute on-chain. Surface that instead of silently disputing here.
      return {
        status: 'CONFLICT',
        message: 'You and your opponent named different winners. Open a dispute to have it reviewed.',
      };
    }

    return {
      status: 'VOTE_RECORDED',
      message: 'Your vote is recorded on-chain. Waiting for your opponent to confirm.',
    };
  }

}
