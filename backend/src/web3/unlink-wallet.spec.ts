import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unlinking must not strand money.
 *
 * The escrow pays whichever address staked and does not consult this field,
 * but every app-side check does: verifyOnChainWager and verifyOnChainJoin
 * compare the escrow entry against the user's `web3Address`. Clearing it
 * while a wager is live therefore leaves someone with real funds in the
 * contract and no way to register their join, vote or settlement through
 * Vouchit. It used to clear the field unconditionally.
 */
describe('Web3Service.unlinkWallet', () => {
  let service: Web3Service;
  let prisma: {
    user: { update: jest.Mock; findUnique: jest.Mock };
    wagerParticipant: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { update: jest.fn().mockResolvedValue({ id: 'u1', web3Address: null }), findUnique: jest.fn() },
      wagerParticipant: { count: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [Web3Service, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<Web3Service>(Web3Service);
  });

  it('unlinks when nothing is open', async () => {
    prisma.wagerParticipant.count.mockResolvedValue(0);

    await expect(service.unlinkWallet('u1')).resolves.toEqual(
      expect.objectContaining({ message: expect.stringContaining('unlinked') }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { web3Address: null } }),
    );
  });

  it('refuses while a wager is still live, and changes nothing', async () => {
    prisma.wagerParticipant.count.mockResolvedValue(1);

    await expect(service.unlinkWallet('u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('counts only the statuses where money is actually at stake', async () => {
    // SETTLED, CANCELLED and EXPIRED wagers are finished: the contract has
    // already paid or refunded, so they must not block someone from moving on.
    prisma.wagerParticipant.count.mockResolvedValue(0);
    await service.unlinkWallet('u1');

    const where = prisma.wagerParticipant.count.mock.calls[0][0].where;
    expect(where.wager.status.in).toEqual(['PENDING_FUNDING', 'ACTIVE', 'DISPUTED']);
    expect(where.userId).toBe('u1');
  });

  it('says what to do about it, not just no', async () => {
    prisma.wagerParticipant.count.mockResolvedValue(2);

    await expect(service.unlinkWallet('u1')).rejects.toThrow(/settle or cancel/i);
  });
});
