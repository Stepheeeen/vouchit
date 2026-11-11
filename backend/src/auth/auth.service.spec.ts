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
        otpAttempts: 0,
        password: '$2b$10$notarealhash',
      });
      // The row AFTER verification is what gets signed, so it must carry the
      // session generation the token is pinned to.
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        role: 'USER',
        emailVerified: true,
        sessionsValidFrom: new Date(),
        password: '$2b$10$notarealhash',
        otp: null,
      });

      const result: any = await service.verifyEmail('a@example.com', '123456');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('otp');
    });

    it('burns the code after repeated wrong guesses', async () => {
      // A six-digit secret with unlimited guesses is not a secret. At the
      // limit the code is destroyed rather than left to be walked through.
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        emailVerified: false,
        otp: '123456',
        otpExpiresAt: new Date(Date.now() + 60_000),
        otpAttempts: 4,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(service.verifyEmail('a@example.com', '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ otp: null, otpExpiresAt: null }),
        }),
      );
    });
  });

  describe('register', () => {
    it('answers identically for a taken address and a fresh one', async () => {
      // The differential reply ("User already exists" vs "Registration
      // successful") turned signup into a user-directory oracle.
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'taken@example.com',
        emailVerified: true,
      });
      const taken: any = await service.register('taken@example.com', 'Correct-Horse-9');

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create = jest.fn().mockResolvedValue({ id: 'u2' });
      const fresh: any = await service.register('fresh@example.com', 'Correct-Horse-9');

      expect(taken.message).toBe(fresh.message);
      expect(taken.success).toBe(fresh.success);
    });

    it('refuses a password that cannot protect an account', async () => {
      // A single character was accepted before this.
      await expect(service.register('a@example.com', 'a')).rejects.toThrow(/at least/i);
    });
  });
});
