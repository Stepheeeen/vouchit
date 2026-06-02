import { Controller, Post, Get, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createDispute(
    @Request() req: any,
    @Body() body: { wagerId: string; reason: string; proofType?: string; mediaUrl?: string },
  ) {
    return this.disputesService.createDispute(
      body.wagerId,
      req.user.userId,
      body.reason,
      body.proofType,
      body.mediaUrl,
    );
  }

  // Admin routes
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  async getAllDisputes() {
    return this.disputesService.getAllDisputes();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':wagerId')
  async getDispute(@Param('wagerId') wagerId: string) {
    return this.disputesService.getDispute(wagerId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/resolve')
  async resolveDispute(
    @Param('id') id: string,
    @Body() body: { resolution: 'WINNER_A' | 'WINNER_B' | 'REFUND' },
  ) {
    if (!body.resolution || !['WINNER_A', 'WINNER_B', 'REFUND'].includes(body.resolution)) {
      throw new BadRequestException('Invalid resolution value');
    }
    return this.disputesService.resolveDispute(id, body.resolution);
  }
}
