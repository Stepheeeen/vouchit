import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async register(email: string, passwordHash: string) {
    if (!email || !passwordHash) throw new BadRequestException('Email and password required');

    let user = await this.prisma.user.findUnique({ where: { email } });
    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    if (user) {
      if (user.emailVerified) {
        throw new BadRequestException('User already exists');
      }
      // Update OTP for unverified user
      await this.prisma.user.update({
        where: { email },
        data: { otp, otpExpiresAt },
      });
    } else {
      const hashedPassword = await bcrypt.hash(passwordHash, 10);
      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          otp,
          otpExpiresAt,
          wallet: {
            create: {
              availableBalance: 0,
              escrowBalance: 0,
              lockedBalance: 0,
            },
          },
        },
        include: { wallet: true },
      });
    }

    // Send via Resend
    try {
      if (process.env.RESEND_API_KEY) {
        await this.resend.emails.send({
          from: 'Vouchit <onboarding@resend.dev>',
          to: email,
          subject: 'Your Vouchit Verification Code',
          html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
        });
      } else {
        console.log(`[Mock Resend] Missing RESEND_API_KEY. OTP is ${otp} for ${email}`);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
    }

    return { message: 'Registration successful. OTP sent to email.', success: true };
  }

  async verifyEmail(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { wallet: true } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.otp !== otp || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.prisma.user.update({
      where: { email },
      data: { emailVerified: true, otp: null, otpExpiresAt: null },
    });

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user,
    };
  }

  async login(email: string, passwordHash: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { wallet: true } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(passwordHash, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerified) throw new UnauthorizedException('Email not verified. Please verify your email first.');

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user,
    };
  }
}
