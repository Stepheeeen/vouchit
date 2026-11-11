import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PUBLIC_USER_SELECT, stripUserSecrets } from '../common/user-select';

/**
 * Preferences a user may set.
 *
 * These were held in localStorage and never sent anywhere, so switching
 * "public profile" off changed nothing but the look of the toggle. Listing
 * them here keeps the update endpoint from accepting arbitrary columns.
 */
export const PREFERENCE_KEYS = [
  'twoFactorEnabled',
  'loginAlertsEnabled',
  'notifyWager',
  'notifyPayout',
  'notifyDispute',
  'notifyMarketing',
  'notifyEmail',
  'publicProfile',
  'showOnLeaderboard',
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

/** Handles are 3-20 chars of letters, numbers, underscore or hyphen. */
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  /** The preference subset of a user row. */
  private pickPreferences(user: Record<string, any>) {
    return Object.fromEntries(PREFERENCE_KEYS.map((k) => [k, user[k]]));
  }

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.pickPreferences(user);
  }

  /** Persist preference changes. Unknown keys are ignored, not written. */
  async updatePreferences(userId: string, patch: Record<string, unknown>) {
    const data: Record<string, boolean> = {};
    for (const key of PREFERENCE_KEYS) {
      if (typeof patch?.[key] === 'boolean') data[key] = patch[key] as boolean;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No recognised preferences in request');
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    return this.pickPreferences(updated);
  }

  /**
   * Delete the account and everything attached to it.
   *
   * There was no way to leave. Wagers already settled on-chain cannot be
   * erased from the chain, and an open wager holds someone else's money
   * against yours, so both are refused rather than half-deleted.
   */
  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const bcrypt = await import('bcrypt');
    const ok = await bcrypt.compare(password ?? '', user.password);
    if (!ok) throw new BadRequestException('Password is incorrect');

    const live = await this.prisma.wagerParticipant.count({
      where: { userId, wager: { status: { in: ['PENDING_FUNDING', 'ACTIVE', 'DISPUTED'] } } },
    });
    if (live > 0) {
      throw new BadRequestException(
        'You have wagers still open on-chain. Settle or cancel them before deleting your account.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { userId } });
      await tx.wagerParticipant.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { message: 'Your account and personal data have been deleted.' };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) throw new NotFoundException('User not found');
    const { password, otp, otpExpiresAt, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Public-safe view of a user. Deliberately excludes email, wallet, tier and
   * anything else that isn't the person's public identity — this backs
   * GET /users/:id, which anybody can call.
   */
  async findPublicById(id: string) {
    // Mongo ObjectIds are 24 hex chars. Passing anything else to Prisma throws a
    // raw client error and surfaces as a 500; this is a not-found, not a crash.
    if (!/^[0-9a-fA-F]{24}$/.test(id ?? '')) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        web3Address: true,
        createdAt: true,
        publicProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // "Public profile" is a real setting now. Answer not-found rather than a
    // stub, so the response cannot be used to confirm the account exists.
    if (!user.publicProfile) throw new NotFoundException('User not found');

    // Public record: wins/losses only, never amounts.
    const participations = await this.prisma.wagerParticipant.findMany({
      where: { userId: id, wager: { status: 'SETTLED' } },
      include: { wager: { select: { winnerId: true } } },
    });
    const wins = participations.filter((p) => p.wager.winnerId === id).length;
    const losses = participations.length - wins;

    const { publicProfile, ...publicFields } = user;
    return {
      ...publicFields,
      // Everyone used to render as "Vouchit user", so you could not tell who
      // you were about to stake money against.
      name: user.displayName || user.username || 'Vouchit user',
      wins,
      losses,
      winRate: participations.length > 0 ? Math.round((wins / participations.length) * 100) : 0,
    };
  }

  async updateMe(
    id: string,
    data: { displayName?: string; bio?: string; avatarUrl?: string; username?: string },
  ) {
    let username: string | undefined;
    if (data.username !== undefined) {
      username = String(data.username).trim();
      if (!USERNAME_RE.test(username)) {
        throw new BadRequestException(
          'Username must be 3-20 characters, letters, numbers, underscore or hyphen.',
        );
      }
      // Checked here rather than with a unique index: on MongoDB an optional
      // unique column treats every null as a duplicate, so the index would
      // lock out everyone who hasn't chosen a handle.
      const taken = await this.prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      });
      if (taken) throw new BadRequestException('That username is taken');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(username !== undefined && { username }),
      },
    });
    // Never hand back the bcrypt hash or a live OTP, even to the account owner.
    return stripUserSecrets(updated);
  }

  /**
   * Delegates to AuthService so this route cannot drift from
   * POST /auth/change-password. The old copy here hashed the new password
   * with no strength rule and left every other session valid.
   */
  async changePassword(id: string, currentPassword: string, newPassword: string) {
    return this.authService.changePassword(id, currentPassword, newPassword);
  }

  async getLeaderboard() {
    // Get all settled wagers
    const settledWagers = await this.prisma.wager.findMany({
      where: { status: 'SETTLED', winnerId: { not: null } },
      include: {
        participants: {
          include: {
            user: { select: { ...PUBLIC_USER_SELECT, username: true, showOnLeaderboard: true } },
          },
        },
      },
    });

    // Aggregate wins and earnings per user. Earnings are tracked per token —
    // stakes can be USDC or ETH, and summing them into one figure would be
    // meaningless, so we never collapse them into a single number.
    const statsMap = new Map<
      string,
      { user: any; wins: number; losses: number; earnings: Map<string, bigint> }
    >();

    for (const wager of settledWagers) {
      for (const participant of wager.participants) {
        // Opting out is a real setting now, not a localStorage flag the
        // server never heard about.
        if (!participant.user?.showOnLeaderboard) continue;
        const uid = participant.userId;
        if (!statsMap.has(uid)) {
          statsMap.set(uid, { user: participant.user, wins: 0, losses: 0, earnings: new Map() });
        }
        const entry = statsMap.get(uid)!;
        if (wager.winnerId === uid) {
          entry.wins += 1;
          // Mirror the contract's fee: payout = pot - (pot * 250 / 10000).
          let pot: bigint;
          try {
            pot = BigInt(wager.totalPot ?? '0');
          } catch {
            pot = 0n;
          }
          const payout = pot - (pot * 250n) / 10_000n;
          const symbol = wager.tokenSymbol;
          entry.earnings.set(symbol, (entry.earnings.get(symbol) ?? 0n) + payout);
        } else {
          entry.losses += 1;
        }
      }
    }

    const leaders = Array.from(statsMap.values())
      .map((s) => ({
        id: s.user.id,
        // The leaderboard is unauthenticated. It must expose no email — neither
        // as a field nor as a display-name fallback.
        name: s.user.displayName || s.user.username || 'Anonymous',
        avatarUrl: s.user.avatarUrl,
        wins: s.wins,
        losses: s.losses,
        total: s.wins + s.losses,
        winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
        /** Base-unit earnings keyed by token symbol, e.g. { USDC: "125000000" }. */
        earningsByToken: Object.fromEntries(
          Array.from(s.earnings.entries()).map(([symbol, amount]) => [symbol, amount.toString()]),
        ),
      }))
      // Ranked on record alone; cross-token earnings are not comparable.
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
      .slice(0, 20)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    return leaders;
  }

  /**
   * Everything we hold about a user, as one JSON document. Secrets are stripped:
   * the password hash, OTP fields and OTP expiry never leave the server.
   */
  async exportMyData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { notifications: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const participations = await this.prisma.wagerParticipant.findMany({
      where: { userId },
      include: {
        wager: {
          include: {
            participants: { select: { userId: true, side: true, amount: true, status: true } },
            dispute: { include: { evidence: true } },
          },
        },
      },
    });

    const { password, otp, otpExpiresAt, ...safeUser } = user;

    return {
      exportedAt: new Date().toISOString(),
      format: 'vouchit.export.v1',
      user: safeUser,
      wagers: participations.map((p) => ({
        role: p.side,
        myStake: p.amount,
        myStatus: p.status,
        mySettleVote: p.settleVote,
        joinedAt: p.createdAt,
        wager: p.wager,
      })),
    };
  }
}
