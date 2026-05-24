import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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

  @Get(':wagerId')
  async getDispute(@Param('wagerId') wagerId: string) {
    return this.disputesService.getDispute(wagerId);
  }
}
