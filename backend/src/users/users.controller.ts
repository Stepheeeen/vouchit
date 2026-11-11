import { Controller, Get, Param, Patch, Post, Delete, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @Request() req: any,
    @Body() body: { displayName?: string; bio?: string; avatarUrl?: string; username?: string },
  ) {
    return this.usersService.updateMe(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/preferences')
  async getPreferences(@Request() req: any) {
    return this.usersService.getPreferences(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/preferences')
  async updatePreferences(@Request() req: any, @Body() body: Record<string, unknown>) {
    return this.usersService.updatePreferences(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Request() req: any, @Body() body: { password: string }) {
    return this.usersService.deleteAccount(req.user.userId, body?.password);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/export')
  async exportMyData(@Request() req: any) {
    return this.usersService.exportMyData(req.user.userId);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.usersService.getLeaderboard();
  }

  // Declared last so it cannot shadow the literal routes above.
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.usersService.findPublicById(id);
  }
}
