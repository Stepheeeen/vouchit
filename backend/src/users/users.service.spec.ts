import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unit tests with Prisma mocked. The suite previously registered UsersService
 * with no providers at all, so dependency injection failed and the only
 * assertion ("should be defined") never ran.
 */
describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findPublicById', () => {
    it('rejects an id that is not a Mongo ObjectId without querying', async () => {
      // A malformed id used to reach Prisma, which threw a raw client error and
      // surfaced as a 500 rather than a 404.
      await expect(service.findPublicById('not-an-object-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('reports a well-formed but unknown id as not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findPublicById('507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateMe', () => {
    it('never returns the password hash or OTP', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'someone@example.com',
        displayName: 'Someone',
        password: '$2b$10$notarealhash',
        otp: '123456',
        otpExpiresAt: new Date(),
      });

      const result: any = await service.updateMe('u1', { displayName: 'Someone' });

      expect(result.displayName).toBe('Someone');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('otp');
      expect(result).not.toHaveProperty('otpExpiresAt');
    });
  });
});
