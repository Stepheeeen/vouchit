import { Controller, Post, Body, UseGuards, Request, Delete } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('web3')
export class Web3Controller {
  constructor(private readonly web3Service: Web3Service) {}

  @UseGuards(JwtAuthGuard)
  @Post('link-wallet')
  async linkWallet(
    @Request() req: any,
    @Body() body: { address: string; signature: string },
  ) {
    return this.web3Service.linkWallet(req.user.userId, body.address, body.signature);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('unlink-wallet')
  async unlinkWallet(@Request() req: any) {
    return this.web3Service.unlinkWallet(req.user.userId);
  }
}
