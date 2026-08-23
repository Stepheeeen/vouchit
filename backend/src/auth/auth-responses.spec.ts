/**
 * Integration test for the endpoints that return user records.
 *
 * The security review found that several of these returned the raw Prisma
 * `User` row — bcrypt hash, live OTP, email — and that two of them are
 * unauthenticated. Typechecking cannot catch that: the fields are simply
 * present on the object at runtime. This boots the real app against a throwaway
 * in-memory Mongo and asserts on the actual JSON that goes over the wire.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import request from 'supertest';
import { startMongo, type MongoHarness } from '../../test/mongo-harness';
import { AppModule } from '../app.module';
import { PrismaClient } from '@prisma/client';

/** Fields that must never appear in any response body, at any depth. */
const FORBIDDEN = ['password', 'otp', 'otpExpiresAt'];

/** Walk a response body and collect the paths of any forbidden key. */
function findLeaks(value: any, path = '$'): string[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findLeaks(item, `${path}[${i}]`));
  }
  const leaks: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.includes(key)) leaks.push(`${path}.${key}`);
    leaks.push(...findLeaks(child, `${path}.${key}`));
  }
  return leaks;
}

describe('user-bearing endpoints (no credential leakage)', () => {
  let app: INestApplication;
  let mongo: MongoHarness;
  let token: string;
  let userId: string;

  const email = `leak-test-${Date.now()}@example.com`;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    mongo = await startMongo();
    process.env.DATABASE_URL = mongo.uri;
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: process.env,
      stdio: 'ignore',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('registers, verifies and logs in without ever returning secrets', async () => {
    const server = app.getHttpServer();

    await request(server).post('/auth/register').send({ email, password }).expect(201);

    // Read the OTP straight from the database — it must never come back over HTTP.
    const prisma = new PrismaClient();
    const stored = await prisma.user.findUnique({ where: { email } });
    const otp = stored!.otp!;
    await prisma.$disconnect();

    expect(otp).toBeTruthy();

    const verify = await request(server).post('/auth/verify-email').send({ email, otp }).expect(200);
    expect(verify.body.accessToken).toBeTruthy();
    expect(findLeaks(verify.body)).toEqual([]);

    token = verify.body.accessToken;
    userId = verify.body.user.id;

    const login = await request(server).post('/auth/login').send({ email, password }).expect(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(findLeaks(login.body)).toEqual([]);
  }, 60_000);

  it('rejects a replayed OTP once the address is verified', async () => {
    const prisma = new PrismaClient();
    // Re-plant the code an attacker might have captured before it was consumed.
    await prisma.user.update({
      where: { email },
      data: { otp: '123456', otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });
    await prisma.$disconnect();

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, otp: '123456' })
      .expect(401);
  }, 30_000);

  it('does not leak secrets from GET /users/me or PATCH /users/me', async () => {
    const server = app.getHttpServer();

    const me = await request(server).get('/users/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(findLeaks(me.body)).toEqual([]);

    const patched = await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Leak Test' })
      .expect(200);
    expect(findLeaks(patched.body)).toEqual([]);
    expect(patched.body.displayName).toBe('Leak Test');
  }, 30_000);

  it('does not leak secrets or emails from the unauthenticated endpoints', async () => {
    const server = app.getHttpServer();

    // No Authorization header anywhere in this test — these routes are public.
    const wagers = await request(server).get('/wagers').expect(200);
    expect(findLeaks(wagers.body)).toEqual([]);

    const leaderboard = await request(server).get('/users/leaderboard').expect(200);
    expect(findLeaks(leaderboard.body)).toEqual([]);
    expect(JSON.stringify(leaderboard.body)).not.toContain(email);

    const publicProfile = await request(server).get(`/users/${userId}`).expect(200);
    expect(findLeaks(publicProfile.body)).toEqual([]);
    expect(JSON.stringify(publicProfile.body)).not.toContain(email);
  }, 30_000);
});
