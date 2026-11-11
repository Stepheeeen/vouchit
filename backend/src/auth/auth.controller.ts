import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Per-endpoint throttles.
 *
 * None of this existed: twenty wrong verification codes and fifteen wrong
 * passwords in a row all answered 401 with no delay and no lockout, and every
 * call to `register` with an unseen address posted a real email to it. The
 * limits below are tight on the endpoints that guess secrets or send mail,
 * and loose enough not to annoy a person using the app normally.
 */
const GUESS_LIMIT = { default: { limit: 8, ttl: 15 * 60_000 } };
const EMAIL_LIMIT = { default: { limit: 4, ttl: 15 * 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle(EMAIL_LIMIT)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: { email: string; password: string }) {
    return this.authService.register(body.email, body.password);
  }

  @Throttle(EMAIL_LIMIT)
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() body: { email: string }) {
    return this.authService.resendOtp(body.email);
  }

  @Throttle(GUESS_LIMIT)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: { email: string; otp: string }) {
    return this.authService.verifyEmail(body.email, body.otp);
  }

  @Throttle(GUESS_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Throttle(GUESS_LIMIT)
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  async loginTwoFactor(@Body() body: { email: string; otp: string }) {
    return this.authService.loginTwoFactor(body.email, body.otp);
  }

  @Throttle(EMAIL_LIMIT)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Throttle(GUESS_LIMIT)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { email: string; otp: string; password: string }) {
    return this.authService.resetPassword(body.email, body.otp, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(GUESS_LIMIT)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sign-out-all')
  @HttpCode(HttpStatus.OK)
  async signOutAll(@Request() req: any) {
    return this.authService.signOutAllDevices(req.user.userId);
  }
}
