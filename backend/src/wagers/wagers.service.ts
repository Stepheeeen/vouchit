import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WagersService {
  constructor(private prisma: PrismaService) {}

  async createWager(userId: string, description: string, amount: number) {
    // Basic implementation: Create a wager and add creator as participant
    const wager = await this.prisma.wager.create({
      data: {
        creatorId: userId,
        description,
        totalPot: amount,
        status: 'PENDING_FUNDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        participants: {
          create: {
            userId,
            side: 'CREATOR',
            amount,
            status: 'PENDING',
          }
        }
      },
      include: { participants: true, creator: true }
    });
    return wager;
  }

  async findAll() {
    return this.prisma.wager.findMany({
      where: { status: 'PENDING_FUNDING' },
      include: { creator: true, participants: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const wager = await this.prisma.wager.findUnique({
      where: { id },
      include: { creator: true, participants: { include: { user: true } } }
    });
    if (!wager) throw new NotFoundException('Wager not found');
    return wager;
  }

  async joinWager(wagerId: string, userId: string, amount: number) {
    const wager = await this.findOne(wagerId);
    if (wager.creatorId === userId) {
      throw new BadRequestException('Creator cannot join their own wager as a challenger');
    }
    if (wager.participants.length >= 2) {
      throw new BadRequestException('Wager already has two participants');
    }

    const participant = await this.prisma.wagerParticipant.create({
      data: {
        wagerId,
        userId,
        side: 'CHALLENGER',
        amount,
        status: 'PENDING'
      }
    });

    // Update total pot
    await this.prisma.wager.update({
      where: { id: wagerId },
      data: {
        totalPot: Number(wager.totalPot) + amount,
        status: 'ACTIVE' // Moving to active once joined
      }
    });

    return participant;
  }
}
