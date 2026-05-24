import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DisputesService {
  constructor(private prisma: PrismaService) {}

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

    if (wager.status !== 'ACTIVE') {
      throw new BadRequestException('Disputes can only be opened on active wagers');
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
}
