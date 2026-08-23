import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Web3Service } from '../web3/web3.service';
import { ADMIN_USER_SELECT } from '../common/user-select';

@Injectable()
export class DisputesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private web3Service: Web3Service,
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
        evidence: { include: { user: { select: ADMIN_USER_SELECT } } },
        wager: {
          include: {
            creator: { select: ADMIN_USER_SELECT },
            participants: { include: { user: { select: ADMIN_USER_SELECT } } },
          },
        },
      },
    });
    if (!dispute) throw new NotFoundException('No dispute found for this wager');
    return dispute;
  }

  async getAllDisputes() {
    return this.prisma.dispute.findMany({
      include: {
        evidence: { include: { user: { select: ADMIN_USER_SELECT } } },
        wager: {
          include: {
            creator: { select: ADMIN_USER_SELECT },
            participants: { include: { user: { select: ADMIN_USER_SELECT } } },
          },
        },
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
            participants: { include: { user: { select: ADMIN_USER_SELECT } } },
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

    if (!wager.contractWagerId) {
      throw new BadRequestException('This wager has no escrow entry to resolve');
    }

    if (resolution === 'REFUND') {
      // Move the money first: the escrow contract is the source of truth, and our
      // rows are only a mirror of it. If the relayer call fails we must not have
      // already told users they were refunded.
      const tx = await this.web3Service.resolveOnChainDispute(
        wager.id,
        wager.contractWagerId,
        '0x0000000000000000000000000000000000000000',
        2,
      );

      await this.prisma.$transaction(async (db) => {
        await db.wagerParticipant.updateMany({
          where: { wagerId: wager.id },
          data: { status: 'REFUNDED' },
        });
        await db.wager.update({ where: { id: wager.id }, data: { status: 'CANCELLED' } });
        await db.dispute.update({
          where: { id: disputeId },
          data: { status: 'RESOLVED', resolution: 'REFUND' },
        });
      });

      try {
        for (const p of wager.participants) {
          await this.notificationsService.createNotification(
            p.userId,
            'DISPUTE_RESOLVED',
            `Dispute for wager "${wager.description.slice(0, 40)}" has been resolved. Both stakes were refunded on-chain.`,
          );
        }
      } catch (err) {
        console.error('Failed to send dispute notifications:', err);
      }

      return {
        status: 'RESOLVED',
        resolution: 'REFUND',
        txHash: tx.txHash,
        message: 'Dispute resolved. Both parties refunded on-chain.',
      };
    }

    // Settle for Winner A (Creator) or Winner B (Challenger)
    const creatorParticipant = wager.participants.find((p) => p.side === 'CREATOR');
    const challengerParticipant = wager.participants.find((p) => p.side === 'CHALLENGER');

    const winnerParticipant = resolution === 'WINNER_A' ? creatorParticipant : challengerParticipant;
    if (!winnerParticipant) {
      throw new BadRequestException('Winner participant not found');
    }

    const winnerAddress = winnerParticipant.user?.web3Address;
    if (!winnerAddress) {
      // Previously this fell back to the zero address, which would either revert
      // or burn the pot. Refuse instead.
      throw new BadRequestException(
        'The winner has no linked wallet, so the payout cannot be sent on-chain.',
      );
    }

    const winnerUserId = winnerParticipant.userId;
    const tx = await this.web3Service.resolveOnChainDispute(
      wager.id,
      wager.contractWagerId,
      winnerAddress,
      1,
    );

    await this.prisma.$transaction(async (db) => {
      await db.wager.update({
        where: { id: wager.id },
        data: { status: 'SETTLED', winnerId: winnerUserId },
      });
      await db.dispute.update({
        where: { id: disputeId },
        data: { status: 'RESOLVED', resolution },
      });
    });

    try {
      const winnerName =
        winnerParticipant.user?.displayName || 'The winner';
      for (const p of wager.participants) {
        const msg =
          p.userId === winnerUserId
            ? `Dispute resolved! You won "${wager.description.slice(0, 40)}". The escrow has paid out your winnings on-chain, less the 2.5% protocol fee.`
            : `Dispute resolved for wager: "${wager.description.slice(0, 40)}". Winner: ${winnerName}.`;
        await this.notificationsService.createNotification(p.userId, 'DISPUTE_RESOLVED', msg);
      }
    } catch (err) {
      console.error('Failed to send dispute notifications:', err);
    }

    return {
      status: 'RESOLVED',
      resolution,
      winnerId: winnerUserId,
      txHash: tx.txHash,
      message: 'Dispute resolved. The escrow paid the winner on-chain.',
    };
  }
}
