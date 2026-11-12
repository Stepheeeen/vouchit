import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Web3Service } from '../web3/web3.service';
import { findToken, parseTokenAmount, NATIVE_TOKEN_ADDRESS as ZERO_ADDRESS } from '../web3/tokens';
import { OnChainWagerStatus } from '../web3/escrow.abi';
import { PUBLIC_USER_SELECT } from '../common/user-select';
import { VerificationService, TIER_LIMITS } from '../web3/verification.service';
import { formatTokenAmount } from '../web3/tokens';

/**
 * Categories Explore can filter by.
 *
 * Explore shipped with these filters while nothing could set a category, so
 * every one of them matched nothing. Validated against a list rather than
 * stored free-form, or the filters drift out of agreement again.
 */
export const WAGER_CATEGORIES = [
  'SPORTS',
  'CRYPTO',
  'LIFESTYLE',
  'ENTERTAINMENT',
  'FINANCE',
  'OTHER',
] as const;

function normaliseCategory(value?: string): string {
  const upper = String(value ?? '').trim().toUpperCase();
  return (WAGER_CATEGORIES as readonly string[]).includes(upper) ? upper : 'OTHER';
}

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
    category?: string,
    visibility?: string,
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

    // One escrow entry backs exactly one wager. This must be checked here, not
    // left to `contractWagerId @unique`: on MongoDB that index only exists after
    // `prisma db push`, which the deploy never runs — and running it would build
    // a unique index on the optional web3Address too, where every user without a
    // linked wallet counts as a duplicate null and signups start failing.
    const alreadyRegistered = await this.prisma.wager.findUnique({ where: { contractWagerId } });
    if (alreadyRegistered) {
      throw new BadRequestException('This escrow entry is already registered as a wager');
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
    // shape, so it is gated per tier — see TIER_LIMITS, where NEWCOMER is
    // currently allowed because no signal can promote an account past it.
    const isOpenWager = onChain.challenger === '0x0000000000000000000000000000000000000000';
    if (isOpenWager && !limits.canCreateOpenWagers) {
      throw new BadRequestException(
        'Your current tier can only create wagers aimed at a specific opponent. Verify your wallet to open wagers to anyone.',
      );
    }

    // The chain is the source of truth for expiry, exactly as it is for stake
    // and status. Deriving it from client input instead let a creator advertise
    // a 30-day wager backed by a 60-second escrow, then reclaim the stake via
    // cancelExpiredWager while the listing still showed it as joinable.
    const expiresAt = new Date(onChain.expiresAt * 1000);
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This escrow entry has already expired on-chain');
    }

    const wager = await this.prisma.wager.create({
      data: {
        creatorId: userId,
        description,
        category: normaliseCategory(category),
        // Mirrored from the escrow entry, never taken from the client: the
        // chain decides who may join, so the listing must agree with it.
        challengerAddress: isOpenWager ? null : onChain.challenger,
        // Private unless the creator deliberately publishes. Every wager was
        // listed on Explore before this — name, description and stake — so a
        // bet between two friends was a public post. Defaulting the other way
        // means nobody publishes one by accident.
        visibility: visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
        // 32 bytes from a CSPRNG. The invite link used to be
        // /vouch/join/<database id>, which is neither secret nor random, so
        // for a private wager the link has to carry something that cannot be
        // guessed or walked.
        inviteToken: randomBytes(32).toString('base64url'),
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
      include: { participants: true, creator: { select: PUBLIC_USER_SELECT } },
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

  /**
   * The Explore feed.
   *
   * This returned every open wager in the database with no visibility filter
   * at all, so a wager aimed at one named opponent was listed publicly with
   * both participants' names, the description and the stake. Explore is now
   * what its name implies: wagers whose creator chose to publish them.
   *
   * `null` counts as public. Wagers created before the column existed were
   * already listed, and quietly hiding them would take away something their
   * creators can currently see.
   */
  async findAll() {
    await this.checkAndProcessExpiredWagers();
    const rows = await this.prisma.wager.findMany({
      where: {
        status: { in: ['PENDING_FUNDING', 'ACTIVE'] },
        OR: [{ visibility: 'PUBLIC' }, { visibility: null }],
      },
      include: {
        creator: { select: PUBLIC_USER_SELECT },
        participants: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // A public wager's token grants nothing its visibility does not already
    // give away, but publishing a secret because it happens to be harmless
    // today is how it stops being harmless tomorrow.
    return rows.map(({ inviteToken, ...w }) => w);
  }

  /**
   * One wager, if the caller is allowed to see it.
   *
   * This route has no auth guard and never had an access check, so every
   * wager in the database was readable by anyone on the internet who had or
   * guessed an id — description, both participants' names, the stake.
   *
   * A private wager is now readable by: a participant, an admin (who has to
   * read it to resolve a dispute), or whoever holds the invite token. That
   * last case is the point of the token — the person being invited is not a
   * participant yet, so they cannot be recognised any other way.
   *
   * Refused reads answer "not found" rather than "forbidden". A 403 would
   * confirm that a wager with that id exists, which is exactly the fact a
   * private wager is keeping.
   */
  async findOne(id: string, viewer?: { userId?: string; role?: string; inviteToken?: string }) {
    await this.checkAndProcessExpiredWagers();
    const wager = await this.prisma.wager.findUnique({
      where: { id },
      include: {
        creator: { select: PUBLIC_USER_SELECT },
        participants: { include: { user: { select: PUBLIC_USER_SELECT } } },
        dispute: true,
      },
    });
    if (!wager) throw new NotFoundException('Wager not found');

    if (!(await this.canView(wager, viewer))) throw new NotFoundException('Wager not found');

    // The token is the key to the door; it must not be handed out to everyone
    // who walks through it. Only the creator needs it back, to build the
    // invite link.
    const isCreator = !!viewer?.userId && viewer.userId === wager.creatorId;
    return { ...wager, inviteToken: isCreator ? wager.inviteToken : undefined };
  }

  /** Null visibility means a wager created before the column existed: public. */
  private async canView(
    wager: {
      visibility: string | null;
      inviteToken: string | null;
      creatorId: string;
      challengerAddress?: string | null;
      participants: Array<{ userId: string }>;
    },
    viewer?: { userId?: string; role?: string; inviteToken?: string },
  ): Promise<boolean> {
    if (wager.visibility !== 'PRIVATE') return true;
    if (viewer?.role === 'ADMIN') return true;
    if (viewer?.userId && wager.participants.some((p) => p.userId === viewer.userId)) return true;
    if (viewer?.userId && viewer.userId === wager.creatorId) return true;
    if (
      viewer?.inviteToken &&
      wager.inviteToken &&
      timingSafeEqualStr(viewer.inviteToken, wager.inviteToken)
    ) {
      return true;
    }

    /**
     * The named opponent can see it without the link.
     *
     * Naming someone's wallet IS the invitation — requiring them to also be
     * sent a link would mean a challenge aimed squarely at one person stayed
     * invisible to them until the creator remembered to message it over. It
     * is no weaker than the token: only the owner of that address can hold a
     * Vouchit account with it linked, which is proven by signature.
     *
     * Checked last, and only for a private wager that actually names an
     * opponent, so the common paths never pay for the extra query.
     */
    if (viewer?.userId && wager.challengerAddress) {
      const me = await this.prisma.user.findUnique({
        where: { id: viewer.userId },
        select: { web3Address: true },
      });
      if (
        me?.web3Address &&
        me.web3Address.toLowerCase() === wager.challengerAddress.toLowerCase()
      ) {
        return true;
      }
    }

    return false;
  }

  async getUserWagers(userId: string) {
    await this.checkAndProcessExpiredWagers();
    const rows = await this.prisma.wager.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: {
        creator: { select: PUBLIC_USER_SELECT },
        participants: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // This list includes wagers the caller only joined, so handing back the
    // token for every one of them would give a challenger the creator's
    // share key — the same thing findOne is careful not to do.
    return rows.map(({ inviteToken, ...w }) =>
      w.creatorId === userId ? { ...w, inviteToken } : w,
    );
  }

  /**
   * Record a join that has already happened on-chain. The challenger escrows
   * their stake by calling `joinWager` on the escrow contract; this only mirrors
   * the result after verifying it against the chain. No funds move here.
   */
  /**
   * Join a wager.
   *
   * `inviteToken` matters only for a PRIVATE wager with no named opponent:
   * the link is the invitation, so holding it is what entitles someone to
   * accept. Where the creator DID name an opponent, the escrow contract
   * enforces that on-chain in `verifyOnChainJoin` below and no token will
   * get a stranger past it — the two controls stack rather than replace one
   * another.
   */
  async joinWager(wagerId: string, userId: string, inviteToken?: string) {
    // Passing the viewer through matters: without it a private wager would
    // answer "not found" to the very person being invited to join it.
    const wager = await this.findOne(wagerId, { userId, inviteToken });

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

    // The same tier limits that bound wager creation must bound joining. Without
    // this a brand-new account could take unlimited exposure simply by joining
    // wagers created by someone else, which is half of every wager.
    const token = findToken(onChain.token);
    if (!token) {
      throw new BadRequestException('This wager uses an unsupported stake currency');
    }

    const { tier, limits } = await this.verificationService.refreshTier(userId);
    const maxStake = token.tierMaxStake[tier] ?? null;
    if (maxStake !== null && onChain.stakeAmount > maxStake) {
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
        `Your current tier allows ${limits.maxConcurrentWagers} open wagers at a time. Settle one before joining another.`,
      );
    }

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
      include: {
        participants: { include: { user: { select: PUBLIC_USER_SELECT } } },
        creator: { select: PUBLIC_USER_SELECT },
      },
    });

    try {
      // Deliberately no email fallback: the local-part of an address is PII and
      // these strings are shown to the counterparty.
      const challengerUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });
      const challengerName = challengerUser?.displayName || 'An opponent';
      const creatorName = wager.creator.displayName || 'The creator';

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
    // The participant check below is the real authorisation; the viewer is
    // passed so a PRIVATE wager does not answer "not found" to one of its
    // own two participants before that check is ever reached.
    const wager = await this.findOne(wagerId, { userId });

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
          const winnerName = winner.user?.displayName || 'The winner';
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

/**
 * Compare two secrets without leaking their contents through timing.
 *
 * `a === b` on a string returns as soon as two characters differ, so how long
 * the comparison takes depends on how much of the token was guessed
 * correctly. That is enough to recover a token one character at a time.
 * Lengths are compared first because `timingSafeEqual` throws on a mismatch.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
