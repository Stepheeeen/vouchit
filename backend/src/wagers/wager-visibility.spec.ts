import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WagersService } from './wagers.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Web3Service } from '../web3/web3.service';
import { VerificationService } from '../web3/verification.service';

/**
 * Who can read a wager.
 *
 * Before visibility existed there was no answer to this question, because
 * there was no check: `GET /wagers/:id` carried no auth guard and `findOne`
 * returned whatever it found. Every wager in the database — description,
 * both participants' names, the stake — was readable by anyone who had or
 * guessed an id, and every wager was listed on Explore besides.
 *
 * These tests fix the boundary in place. They are written as "a stranger
 * tries to read someone else's private wager", because that is the case that
 * has to keep failing, and the three legitimate ways through: being a
 * participant, being an admin with a dispute to resolve, and holding the
 * invite link.
 */
describe('WagersService.findOne — visibility', () => {
  let service: WagersService;
  let prisma: { wager: { findUnique: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock } };

  const TOKEN = 'secret-invite-token-abc123';

  /** A private wager between u-creator and u-challenger. */
  const privateWager = {
    id: 'w1',
    creatorId: 'u-creator',
    visibility: 'PRIVATE',
    inviteToken: TOKEN,
    status: 'PENDING_FUNDING',
    participants: [{ userId: 'u-creator' }],
  };

  const publicWager = { ...privateWager, id: 'w2', visibility: 'PUBLIC' };

  /** Created before the column existed. Was listed; must stay readable. */
  const legacyWager = { ...privateWager, id: 'w3', visibility: null };

  beforeEach(async () => {
    prisma = {
      wager: {
        findUnique: jest.fn(),
        // checkAndProcessExpiredWagers runs first and must find nothing.
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WagersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: {} },
        { provide: Web3Service, useValue: {} },
        { provide: VerificationService, useValue: {} },
      ],
    }).compile();
    service = module.get<WagersService>(WagersService);
  });

  describe('a private wager', () => {
    beforeEach(() => prisma.wager.findUnique.mockResolvedValue(privateWager));

    it('is hidden from a signed-out stranger', async () => {
      await expect(service.findOne('w1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is hidden from a signed-in stranger', async () => {
      await expect(service.findOne('w1', { userId: 'u-nobody' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('says "not found" rather than "forbidden"', async () => {
      // A 403 would confirm a wager with that id exists, which is precisely
      // the fact a private wager is keeping. The message must not differ
      // from a genuinely missing wager either.
      prisma.wager.findUnique.mockResolvedValueOnce(privateWager);
      const refused = await service.findOne('w1').catch((e) => e);
      prisma.wager.findUnique.mockResolvedValueOnce(null);
      const missing = await service.findOne('nope').catch((e) => e);

      expect(refused).toBeInstanceOf(NotFoundException);
      expect(missing).toBeInstanceOf(NotFoundException);
      expect(refused.message).toBe(missing.message);
    });

    it('is readable by a participant', async () => {
      await expect(service.findOne('w1', { userId: 'u-creator' })).resolves.toMatchObject({
        id: 'w1',
      });
    });

    it('is readable by an admin, who has to resolve disputes', async () => {
      await expect(service.findOne('w1', { role: 'ADMIN' })).resolves.toMatchObject({ id: 'w1' });
    });

    it('is readable by whoever holds the invite token', async () => {
      // The person being invited is not a participant yet, so this is the
      // only way they can be recognised at all.
      await expect(service.findOne('w1', { inviteToken: TOKEN })).resolves.toMatchObject({
        id: 'w1',
      });
    });

    it('is not opened by a wrong token', async () => {
      await expect(service.findOne('w1', { inviteToken: 'wrong' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is not opened by a token that is merely a prefix of the real one', async () => {
      await expect(
        service.findOne('w1', { inviteToken: TOKEN.slice(0, -1) }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is not opened by an empty token when none is set', async () => {
      prisma.wager.findUnique.mockResolvedValue({ ...privateWager, inviteToken: null });
      await expect(service.findOne('w1', { inviteToken: '' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('the invite token itself', () => {
    it('is returned to the creator, who needs it to build the link', async () => {
      prisma.wager.findUnique.mockResolvedValue(privateWager);
      const w: any = await service.findOne('w1', { userId: 'u-creator' });
      expect(w.inviteToken).toBe(TOKEN);
    });

    it('is withheld from everyone else who can read the wager', async () => {
      // Otherwise reading a private wager hands you the key to re-share it.
      prisma.wager.findUnique.mockResolvedValue({
        ...privateWager,
        participants: [{ userId: 'u-creator' }, { userId: 'u-challenger' }],
      });
      const asChallenger: any = await service.findOne('w1', { userId: 'u-challenger' });
      expect(asChallenger.inviteToken).toBeUndefined();

      const asAdmin: any = await service.findOne('w1', { role: 'ADMIN' });
      expect(asAdmin.inviteToken).toBeUndefined();

      const asInvitee: any = await service.findOne('w1', { inviteToken: TOKEN });
      expect(asInvitee.inviteToken).toBeUndefined();
    });
  });

  describe('a public wager', () => {
    it('is readable by a signed-out stranger', async () => {
      prisma.wager.findUnique.mockResolvedValue(publicWager);
      await expect(service.findOne('w2')).resolves.toMatchObject({ id: 'w2' });
    });
  });

  describe('a wager created before visibility existed', () => {
    it('stays readable, because it was already public', async () => {
      // Deploys do not run `prisma db push`, so these documents have no
      // visibility field at all. Treating that as private would retroactively
      // hide wagers their creators can currently see.
      prisma.wager.findUnique.mockResolvedValue(legacyWager);
      await expect(service.findOne('w3')).resolves.toMatchObject({ id: 'w3' });
    });
  });
});

describe('WagersService.findAll — the Explore feed', () => {
  let service: WagersService;
  let prisma: { wager: { findMany: jest.Mock; updateMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      wager: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WagersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: {} },
        { provide: Web3Service, useValue: {} },
        { provide: VerificationService, useValue: {} },
      ],
    }).compile();
    service = module.get<WagersService>(WagersService);
  });

  it('never publishes an invite token in the feed', async () => {
    prisma.wager.findMany.mockResolvedValue([
      { id: 'w2', creatorId: 'u1', visibility: 'PUBLIC', inviteToken: 'should-not-ship' },
    ]);
    const rows: any[] = await service.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('inviteToken');
  });

  it('asks only for public wagers', async () => {
    await service.findAll();

    // The last findMany is the listing itself; the first belongs to the
    // expiry sweep that runs ahead of it.
    const calls = prisma.wager.findMany.mock.calls;
    const where = calls[calls.length - 1][0].where;

    expect(where.status.in).toEqual(['PENDING_FUNDING', 'ACTIVE']);
    expect(where.OR).toEqual([{ visibility: 'PUBLIC' }, { visibility: null }]);
  });
});

describe('WagersService.getUserWagers — invite tokens', () => {
  let service: WagersService;
  let prisma: { wager: { findMany: jest.Mock; updateMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      wager: { findMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WagersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: {} },
        { provide: Web3Service, useValue: {} },
        { provide: VerificationService, useValue: {} },
      ],
    }).compile();
    service = module.get<WagersService>(WagersService);
  });

  it('gives the creator their own token but not the other side theirs', async () => {
    // This list mixes wagers the caller created with ones they merely joined.
    // Returning every token would hand a challenger the creator's share key.
    prisma.wager.findMany.mockResolvedValue([
      { id: 'mine', creatorId: 'me', inviteToken: 'tok-mine' },
      { id: 'theirs', creatorId: 'someone-else', inviteToken: 'tok-theirs' },
    ]);

    const rows: any[] = await service.getUserWagers('me');
    const mine = rows.find((r) => r.id === 'mine');
    const theirs = rows.find((r) => r.id === 'theirs');

    expect(mine.inviteToken).toBe('tok-mine');
    expect(theirs).not.toHaveProperty('inviteToken');
  });
});
