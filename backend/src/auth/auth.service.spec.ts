import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unit tests with Prisma and JwtService mocked. The suite previously registered
 * AuthService with no providers, so DI failed before any assertion ran.
 */
describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'signed.jwt.token') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('verifyEmail', () => {
    it('refuses an account that is already verified', async () => {
      // Otherwise a leaked OTP stays a working login indefinitely.
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        emailVerified: true,
        otp: '123456',
        otpExpiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.verifyEmail('a@example.com', '123456')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses an expired OTP', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        emailVerified: false,
        otp: '123456',
        otpExpiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.verifyEmail('a@example.com', '123456')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refuses a wrong OTP, and a null stored OTP against a null guess', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        emailVerified: false,
        otp: null,
        otpExpiresAt: null,
      });

      await expect(service.verifyEmail('a@example.com', 'null')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('issues a token and strips secrets on success', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        role: 'USER',
        emailVerified: false,
        otp: '123456',
        otpExpiresAt: new Date(Date.now() + 60_000),
        password: '$2b$10$notarealhash',
      });
      prisma.user.update.mockResolvedValue({});

      const result: any = await service.verifyEmail('a@example.com', '123456');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('otp');
    });
  });
});
