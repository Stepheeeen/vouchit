import { Controller, Get, Post, Delete, Body, UseGuards, Request, Query } from '@nestjs/common';
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
  async processWithdrawal(@Request() req: any, @Body() body: { amount: number }) {
    return this.ledgerService.processWithdrawal(req.user.userId, body.amount);
  }

  @Get('bank/resolve')
  async resolveBankAccount(
    @Query('accountNumber') accountNumber: string,
    @Query('bankCode') bankCode: string,
  ) {
    return this.ledgerService.resolveBankAccount(accountNumber, bankCode);
  }

  @Get('bank')
  async getBankAccount(@Request() req: any) {
    return this.ledgerService.getBankAccount(req.user.userId);
  }

  @Post('bank')
  async linkBankAccount(
    @Request() req: any, 
    @Body() body: { bankCode: string, bankName: string, accountNumber: string, accountName: string }
  ) {
    return this.ledgerService.linkBankAccount(req.user.userId, body);
  }

  // Use Post/Delete. Let's add an explicit delete. 
  // We need to import Delete from '@nestjs/common' but since we might not have it in the import statement, we can just add it. Wait, I'll update the import first.
  // Actually, I'll update the import at the top too.

  @Delete('bank')
  async unlinkBankAccount(@Request() req: any) {
    return this.ledgerService.unlinkBankAccount(req.user.userId);
  }
}

