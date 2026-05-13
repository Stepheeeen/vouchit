import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  async getWallet(@Request() req: any) {
    return this.ledgerService.getWallet(req.user.userId);
  }

  @Post('deposit')
  async simulateDeposit(@Request() req: any, @Body() body: { amount: number }) {
    return this.ledgerService.simulateDeposit(req.user.userId, body.amount);
  }

  @Post('withdraw')
  async simulateWithdrawal(@Request() req: any, @Body() body: { amount: number }) {
    return this.ledgerService.simulateWithdrawal(req.user.userId, body.amount);
  }
}
