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
    @Body() body: { description: string; amount: number },
  ) {
    return this.wagersService.createWager(req.user.userId, body.description, body.amount);
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
    @Body() body: { amount: number },
  ) {
    return this.wagersService.joinWager(id, req.user.userId, body.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/settle')
  async settleWager(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { winnerId: string },
  ) {
    return this.wagersService.settleWager(id, req.user.userId, body.winnerId);
  }
}
