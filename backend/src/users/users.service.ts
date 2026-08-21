import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { password, otp, otpExpiresAt, ...safeUser } = user;
    return safeUser;
  }

  async updateMe(id: string, data: { displayName?: string; bio?: string; phone?: string }) {
    if (data.phone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone: data.phone, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException('Phone number is already in use');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
      include: { wallet: true },
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
        participants: { include: { user: { include: { wallet: true } } } },
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

  async verifyKYC(userId: string, type: 'BVN' | 'NIN', number: string) {
    if (!type || !['BVN', 'NIN'].includes(type)) {
      throw new BadRequestException('Verification type must be BVN or NIN');
    }
    if (!number || number.length !== 11 || !/^\d+$/.test(number)) {
      throw new BadRequestException('BVN or NIN must be exactly 11 digits');
    }

    if (number === '00000000000') {
      throw new BadRequestException('Invalid identification number. Verification failed.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { kycTier: 1 },
      include: { wallet: true },
    });

    return {
      success: true,
      message: `${type} verified successfully`,
      kycTier: updatedUser.kycTier,
      user: updatedUser,
    };
  }
}

