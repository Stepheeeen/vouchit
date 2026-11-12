import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { WagersService } from './wagers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

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
      /** One of WAGER_CATEGORIES; anything else is stored as OTHER. */
      category?: string;
      /** Id of an already-mined escrow entry, verified on-chain before we accept it. */
      contractWagerId: string;
      /** "PUBLIC" lists it on Explore. Anything else, including absent, is private. */
      visibility?: string;
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
      body.category,
      body.visibility,
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

  /**
   * Readable without signing in, because an invite link has to work before
   * the invited person has an account. The guard is optional rather than
   * absent so that a signed-in participant can still be recognised on a
   * private wager; the service decides who sees what.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getWager(
    @Param('id') id: string,
    @Request() req: any,
    @Query('token') token?: string,
  ) {
    return this.wagersService.findOne(id, {
      userId: req.user?.userId,
      role: req.user?.role,
      inviteToken: token,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinWager(
    @Request() req: any,
    @Param('id') id: string,
    @Query('token') token?: string,
  ) {
    // The stake is fixed by the escrow entry, so there is no client-supplied
    // amount to trust here. The token only unlocks a private wager's link;
    // it cannot override a named opponent, which the contract enforces.
    return this.wagersService.joinWager(id, req.user.userId, token);
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
