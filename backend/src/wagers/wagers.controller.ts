import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WagersService } from './wagers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wagers')
export class WagersController {
  constructor(private readonly wagersService: WagersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createWager(
    @Request() req: any,
    @Body() body: {
      description: string;
      /** Human-readable token amount, e.g. "25" for 25 USDC. */
      stake: string;
      /** Stake token; the zero address means the chain's native coin. */
      tokenAddress: string;
      isSymmetric?: boolean;
      expiryDays?: number;
      /** Id of an already-mined escrow entry, verified on-chain before we accept it. */
      contractWagerId: string;
    },
  ) {
    return this.wagersService.createWager(
      req.user.userId,
      body.description,
      body.stake,
      body.tokenAddress,
      body.contractWagerId,
      body.isSymmetric,
      body.expiryDays,
    );
  }

  @Get()
  async getAllWagers() {
    return this.wagersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyWagers(@Request() req: any) {
    return this.wagersService.getUserWagers(req.user.userId);
  }

  @Get(':id')
  async getWager(@Param('id') id: string) {
    return this.wagersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinWager(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    // The stake is fixed by the escrow entry, so there is no client-supplied
    // amount to trust here.
    return this.wagersService.joinWager(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/settle')
  async settleWager(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    // The winner is decided by on-chain votes, so there is nothing to accept
    // from the client here — this just syncs our records with the contract.
    return this.wagersService.settleWager(id, req.user.userId);
  }
}
