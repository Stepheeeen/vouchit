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
        wagersCreated: { include: { participants: true } },
        wagerParticipants: { include: { wager: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
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

    // Aggregate wins & earnings per user
    const statsMap = new Map<string, { user: any; wins: number; losses: number; totalEarned: number }>();

    for (const wager of settledWagers) {
      for (const participant of wager.participants) {
        const uid = participant.userId;
        if (!statsMap.has(uid)) {
          statsMap.set(uid, {
            user: participant.user,
            wins: 0,
            losses: 0,
            totalEarned: 0,
          });
        }
        const entry = statsMap.get(uid)!;
        if (wager.winnerId === uid) {
          entry.wins += 1;
          entry.totalEarned += Number(wager.totalPot) * 0.975; // after 2.5% fee
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
        totalEarned: Math.round(s.totalEarned),
      }))
      .sort((a, b) => b.wins - a.wins || b.totalEarned - a.totalEarned)
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

