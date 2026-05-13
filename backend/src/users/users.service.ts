import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
        wagersCreated: true,
        wagerParticipants: { include: { wager: true } }
      }
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
