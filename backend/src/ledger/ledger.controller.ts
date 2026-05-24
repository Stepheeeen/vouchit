import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
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

  @Post('deposit/initialize')
  async initializeDeposit(@Request() req: any, @Body() body: { amount: number }) {
    return this.ledgerService.initializeDeposit(req.user.userId, body.amount);
  }

  @Get('deposit/verify')
  async verifyDeposit(@Request() req: any, @Query('reference') reference: string) {
    return this.ledgerService.verifyDeposit(req.user.userId, reference);
  }

  // Kept for backward compatibility or direct simulation testing
  @Post('deposit')
  async simulateDeposit(@Request() req: any, @Body() body: { amount: number }) {
    // Redirect to initialize for the new flow, or keep as a simple mock endpoint if desired.
    // For now we will just throw an error so the frontend must use the new flow.
    throw new Error('Please use /wallet/deposit/initialize');
  }

  @Post('withdraw')
  async simulateWithdrawal(@Request() req: any, @Body() body: { amount: number }) {
    return this.ledgerService.simulateWithdrawal(req.user.userId, body.amount);
  }

  @Get('bank/resolve')
  async resolveBankAccount(
    @Query('accountNumber') accountNumber: string,
    @Query('bankCode') bankCode: string,
  ) {
    return this.ledgerService.resolveBankAccount(accountNumber, bankCode);
  }
}

