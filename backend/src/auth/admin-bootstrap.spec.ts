import { Test, type TestingModule } from '@nestjs/testing';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ADMIN_EMAILS grants privileges, so what it will NOT do matters more than
 * what it will. The dangerous shapes are: demoting people because a variable
 * got truncated, inventing accounts that nobody controls, and taking the API
 * down when the database is unreachable.
 */
describe('AdminBootstrapService', () => {
  let service: AdminBootstrapService;
  let prisma: { user: { findMany: jest.Mock; updateMany: jest.Mock } };
  const ORIGINAL = process.env.ADMIN_EMAILS;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminBootstrapService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminBootstrapService);
    // The service no-ops under NODE_ENV=test, which is how jest runs; these
    // tests are about the production path, so step out of that guard.
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL;
  });

  it('does nothing when the variable is unset', async () => {
    delete process.env.ADMIN_EMAILS;
    await service.onModuleInit();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when the variable is empty or just commas', async () => {
    process.env.ADMIN_EMAILS = ' , ,, ';
    await service.onModuleInit();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('stays out of the way entirely under NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_EMAILS = 'a@b.com';
    await service.onModuleInit();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('promotes an existing account that is not yet an admin', async () => {
    process.env.ADMIN_EMAILS = 'a@b.com';
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@b.com', role: 'USER' }]);

    await service.onModuleInit();

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1'] } },
      data: { role: 'ADMIN' },
    });
  });

  it('handles several addresses, trimming and lowercasing them', async () => {
    process.env.ADMIN_EMAILS = ' A@B.com , c@d.com ';
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@b.com', role: 'USER' },
      { id: 'u2', email: 'c@d.com', role: 'USER' },
    ]);

    await service.onModuleInit();

    expect(prisma.user.findMany.mock.calls[0][0].where.email.in).toEqual(['a@b.com', 'c@d.com']);
    expect(prisma.user.updateMany.mock.calls[0][0].where.id.in).toEqual(['u1', 'u2']);
  });

  it('writes nothing when everyone named is already an admin', async () => {
    process.env.ADMIN_EMAILS = 'a@b.com';
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@b.com', role: 'ADMIN' }]);

    await service.onModuleInit();

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('NEVER demotes an admin missing from the list', async () => {
    // A truncated or mistyped variable would otherwise strip every admin and
    // lock the disputes queue — the exact failure this exists to prevent.
    process.env.ADMIN_EMAILS = 'a@b.com';
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@b.com', role: 'ADMIN' }]);

    await service.onModuleInit();

    const wrote = prisma.user.updateMany.mock.calls.map((c) => c[0]?.data?.role);
    expect(wrote).not.toContain('USER');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('never creates an account for an address that does not exist', async () => {
    process.env.ADMIN_EMAILS = 'ghost@nowhere.com';
    prisma.user.findMany.mockResolvedValue([]);

    await service.onModuleInit();

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('reads only id, email and role', async () => {
    // A wide select would throw on any account missing a column added since
    // it was written, and take startup down with it.
    process.env.ADMIN_EMAILS = 'a@b.com';
    await service.onModuleInit();
    expect(prisma.user.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      email: true,
      role: true,
    });
  });

  it('does not stop the app starting when the database is unreachable', async () => {
    process.env.ADMIN_EMAILS = 'a@b.com';
    prisma.user.findMany.mockRejectedValue(new Error('connection refused'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
