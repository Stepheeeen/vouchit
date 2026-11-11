import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.userId !== userId) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * Which preference governs which notification type.
   *
   * Types not listed here are account-level messages a user cannot opt out
   * of — security and settlement outcomes they need to see.
   */
  private static readonly PREFERENCE_FOR_TYPE: Record<string, string> = {
    WAGER_CREATED: 'notifyWager',
    WAGER_JOINED: 'notifyWager',
    WAGER_EXPIRED: 'notifyWager',
    WAGER_SETTLED: 'notifyPayout',
    PAYOUT: 'notifyPayout',
    DISPUTE_OPENED: 'notifyDispute',
    DISPUTE_RESOLVED: 'notifyDispute',
    MARKETING: 'notifyMarketing',
  };

  /**
   * Record a notification, unless the user switched that category off.
   *
   * The preference toggles were localStorage-only, so turning a category off
   * changed what the switch looked like and nothing else — every notification
   * still arrived.
   */
  async createNotification(userId: string, type: string, message: string) {
    const preference = NotificationsService.PREFERENCE_FOR_TYPE[type];
    if (preference) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { [preference]: true } as any,
      });
      if (user && (user as any)[preference] === false) return null;
    }

    return this.prisma.notification.create({
      data: {
        userId,
        type,
        message,
      },
    });
  }
}
