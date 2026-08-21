import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        web3Address: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Public record: wins/losses only, never amounts.
    const participations = await this.prisma.wagerParticipant.findMany({
      where: { userId: id, wager: { status: 'SETTLED' } },
      include: { wager: { select: { winnerId: true } } },
    });
    const wins = participations.filter((p) => p.wager.winnerId === id).length;
    const losses = participations.length - wins;

    return {
      ...user,
      name: user.displayName || 'Vouchit user',
      wins,
      losses,
      winRate: participations.length > 0 ? Math.round((wins / participations.length) * 100) : 0,
    };
  }

  async updateMe(id: string, data: { displayName?: string; bio?: string; avatarUrl?: string }) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
    });
    return updated;
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { password: hashed } });
    return { message: 'Password updated successfully' };
  }

  async getLeaderboard() {
    // Get all settled wagers
    const settledWagers = await this.prisma.wager.findMany({
      where: { status: 'SETTLED', winnerId: { not: null } },
      include: {
        participants: { include: { user: true } },
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
        name: s.user.displayName || s.user.email.split('@')[0],
        email: s.user.email,
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
