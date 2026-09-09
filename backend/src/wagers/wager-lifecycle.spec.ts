/**
 * Full-stack end-to-end: real contract on a real chain, real database, real API,
 * real signatures.
 *
 * The contract suite proves the escrow behaves. This proves the API and the
 * escrow agree — that a wager created on-chain is accepted, that a fabricated
 * one is refused, that the challenger's join is verified against the contract
 * rather than trusted, and that settlement is mirrored from the chain instead of
 * decided by us.
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hexlify, randomBytes, parseEther, ZeroAddress, Contract } from 'ethers';
import { AppModule } from '../app.module';
import { PrismaClient } from '@prisma/client';
import { startMongo, type MongoHarness } from '../../test/mongo-harness';
import { startChain, type ChainHarness } from '../../test/chain-harness';

jest.setTimeout(180_000);

/** Assert a status, reporting the API's error body when it does not match. */
function expectStatus(res: any, expected: number) {
  if (res.status !== expected) {
    throw new Error(`expected ${expected}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

const STAKE = parseEther('0.005'); // within the tier-0 cap of 0.01 ETH
const ONE_DAY = 24 * 60 * 60;

describe('wager lifecycle (API + escrow + database)', () => {
  let mongo: MongoHarness;
  let chain: ChainHarness;
  let app: INestApplication;
  let server: any;
  let prisma: PrismaClient;

  /** [alice, bob] — API session tokens and their linked on-chain wallets. */
  const users: Array<{ token: string; id: string; email: string; walletIndex: number }> = [];

  /** Register, verify via the OTP in the database, and link a wallet by signature. */
  async function createUser(walletIndex: number) {
    const email = `e2e-${walletIndex}-${Date.now()}@vouchit.test`;
    const password = 'CorrectHorseBattery1!';

    await request(server).post('/auth/register').send({ email, password }).expect(201);
    const registered = await prisma.user.findUnique({ where: { email } });
    const verify = await request(server)
      .post('/auth/verify-email')
      .send({ email, otp: registered!.otp })
      .expect(200);

    const token: string = verify.body.accessToken;
    const id: string = verify.body.user.id;

    const wallet = chain.wallets[walletIndex];
    const message = `Sign to verify ownership of wallet ${wallet.address} for Vouchit account ${id}`;
    const signature = await wallet.signMessage(message);

    await request(server)
      .post('/web3/link-wallet')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: wallet.address, signature })
      .expect(201);

    users.push({ token, id, email, walletIndex });
  }

  beforeAll(async () => {
    mongo = await startMongo(27078);
    chain = await startChain(8546);

    process.env.DATABASE_URL = mongo.uri;
    process.env.WEB3_CHAIN_ID = String(chain.chainId);
    process.env.WEB3_RPC_URL = chain.rpcUrl;
    process.env.VOUCHIT_ESCROW_CONTRACT_ADDRESS = chain.escrowAddress;

    prisma = new PrismaClient();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    await createUser(2); // alice
    await createUser(3); // bob
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await chain?.stop();
    await mongo?.stop();
  });

  it('links each wallet to exactly one account', async () => {
    const alice = await prisma.user.findUnique({ where: { id: users[0].id } });
    expect(alice!.web3Address).toBe(chain.wallets[2].address.toLowerCase());

    // A second account must not be able to claim a wallet already linked.
    const wallet = chain.wallets[2];
    const message = `Sign to verify ownership of wallet ${wallet.address} for Vouchit account ${users[1].id}`;
    const signature = await wallet.signMessage(message);

    await request(server)
      .post('/web3/link-wallet')
      .set('Authorization', `Bearer ${users[1].token}`)
      .send({ address: wallet.address, signature })
      .expect(400);
  });

  it('refuses a wager id that does not exist on the escrow', async () => {
    const res = await request(server)
      .post('/wagers')
      .set('Authorization', `Bearer ${users[0].token}`)
      .send({
        description: 'A wager backed by absolutely nothing at all',
        stake: '0.005',
        tokenAddress: ZeroAddress,
        contractWagerId: hexlify(randomBytes(32)),
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/no such wager|does not exist/i);
  });

  it('refuses a wager escrowed by a different wallet', async () => {
    // Bob escrows on-chain, then Alice tries to register it as hers.
    const wagerId = hexlify(randomBytes(32));
    const escrowAsBob = chain.escrow.connect(chain.wallets[3]) as any;
    await (
      await escrowAsBob.createWager(wagerId, ZeroAddress, ZeroAddress, STAKE, ONE_DAY, { value: STAKE })
    ).wait();

    const res = await request(server)
      .post('/wagers')
      .set('Authorization', `Bearer ${users[0].token}`)
      .send({
        description: 'Trying to claim someone elses escrowed stake',
        stake: '0.005',
        tokenAddress: ZeroAddress,
        contractWagerId: wagerId,
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/different wallet/i);
  });

  it('runs the full lifecycle: create, join, vote, settle, pay out', async () => {
    const wagerId = hexlify(randomBytes(32));
    const alice = chain.wallets[2];
    const bob = chain.wallets[3];

    // 1. Alice escrows her stake on-chain, then registers it with the API.
    const escrowAsAlice = chain.escrow.connect(alice) as any;
    await (
      await escrowAsAlice.createWager(wagerId, bob.address, ZeroAddress, STAKE, ONE_DAY, { value: STAKE })
    ).wait();

    const created = await request(server)
      .post('/wagers')
      .set('Authorization', `Bearer ${users[0].token}`)
      .send({
        description: 'Arsenal will win their next match convincingly',
        stake: '0.005',
        tokenAddress: ZeroAddress,
        contractWagerId: wagerId,
      });
    expectStatus(created, 201);

    const dbWagerId: string = created.body.id;
    expect(created.body.status).toBe('PENDING_FUNDING');
    expect(created.body.onChainStake).toBe(STAKE.toString());

    // Expiry must come from the contract, not from client input.
    const onChainBefore = await chain.escrow.wagers(wagerId);
    expect(new Date(created.body.expiresAt).getTime()).toBe(Number(onChainBefore.expiresAt) * 1000);

    // 2. Bob matches the stake on-chain, then registers the join.
    const escrowAsBob = chain.escrow.connect(bob) as any;
    await (await escrowAsBob.joinWager(wagerId, { value: STAKE })).wait();

    const joined = await request(server)
      .post(`/wagers/${dbWagerId}/join`)
      .set('Authorization', `Bearer ${users[1].token}`)
      .send({});
    expectStatus(joined, 201);

    expect(joined.body.status).toBe('ACTIVE');
    // The pot comes from the contract's accounting, never summed locally.
    expect(joined.body.totalPot).toBe((STAKE * 2n).toString());

    // 3. One vote alone must not settle anything.
    await (await (chain.escrow.connect(alice) as any).voteWinner(wagerId, bob.address)).wait();
    const partial = await request(server)
      .post(`/wagers/${dbWagerId}/settle`)
      .set('Authorization', `Bearer ${users[0].token}`)
      .send({});
    expectStatus(partial, 201);
    expect(partial.body.status).toBe('VOTE_RECORDED');

    // 4. Both agree — the contract pays out on the second vote.
    const bobBefore = await chain.provider.getBalance(bob.address);
    const treasuryBefore = await chain.provider.getBalance(chain.wallets[1].address);
    const escrowBefore = await chain.provider.getBalance(chain.escrowAddress);

    const voteTx = await (chain.escrow.connect(bob) as any).voteWinner(wagerId, bob.address);
    const receipt: any = await voteTx.wait();
    const gas = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice);

    const pot = STAKE * 2n;
    const fee = (pot * 250n) / 10_000n;

    const bobGained = (await chain.provider.getBalance(bob.address)) - bobBefore + gas;
    expect(bobGained).toBe(pot - fee);
    expect((await chain.provider.getBalance(chain.wallets[1].address)) - treasuryBefore).toBe(fee);
    // Earlier cases in this file leave their own stakes escrowed on purpose, so
    // check this wager's pot left the contract rather than that it is empty.
    expect(escrowBefore - (await chain.provider.getBalance(chain.escrowAddress))).toBe(pot);

    // 5. The API mirrors what the chain did — it does not decide the outcome.
    const settled = await request(server)
      .post(`/wagers/${dbWagerId}/settle`)
      .set('Authorization', `Bearer ${users[1].token}`)
      .send({});
    expectStatus(settled, 201);

    expect(settled.body.status).toBe('SETTLED');
    expect(settled.body.winnerId).toBe(users[1].id);

    const stored = await prisma.wager.findUnique({ where: { id: dbWagerId } });
    expect(stored!.status).toBe('SETTLED');
    expect(stored!.winnerId).toBe(users[1].id);
  });

  it('enforces the tier-0 stake ceiling before the wager is recorded', async () => {
    const overCap = parseEther('0.05'); // above the 0.01 ETH tier-0 cap
    const wagerId = hexlify(randomBytes(32));
    await (
      await (chain.escrow.connect(chain.wallets[2]) as any).createWager(
        wagerId, chain.wallets[3].address, ZeroAddress, overCap, ONE_DAY, { value: overCap },
      )
    ).wait();

    const res = await request(server)
      .post('/wagers')
      .set('Authorization', `Bearer ${users[0].token}`)
      .send({
        description: 'A stake far above what a new account may risk',
        stake: '0.05',
        tokenAddress: ZeroAddress,
        contractWagerId: wagerId,
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/allows stakes up to/i);
  });
});
