import { Test, type TestingModule } from '@nestjs/testing';
import { Wallet } from 'ethers';
import { Web3Service } from './web3.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Wallet linking is the gate on every on-chain action, and it was rejecting
 * the only wallet the product actually offers.
 *
 * `ethers.verifyMessage()` recovers a public key from an ECDSA signature.
 * A Coinbase Smart Wallet — which `preference: smartWalletOnly` means every
 * passkey user gets — is an ERC-4337 contract account whose signatures are
 * validated by calling `isValidSignature` on the contract (ERC-1271), and
 * which is counterfactual until its first transaction so the signature
 * arrives ERC-6492-wrapped. Recovery cannot verify either, so linking failed
 * with "Invalid signature" for every such user.
 *
 * These tests pin the behaviour that matters: a real key-pair signature is
 * accepted, a signature for the wrong message or the wrong address is not,
 * and a signature shaped like a smart-wallet one is not silently waved
 * through by the ECDSA fast path.
 */
describe('Web3Service.verifySignature', () => {
  let service: Web3Service;
  const savedRpc = process.env.WEB3_RPC_URL;

  beforeEach(async () => {
    // These cases must not reach the network. With no RPC configured the
    // contract-wallet path fails closed immediately, so the assertions are
    // about this code rather than about some public node being reachable.
    delete process.env.WEB3_RPC_URL;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Web3Service,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn(), update: jest.fn() } } },
      ],
    }).compile();
    service = module.get<Web3Service>(Web3Service);
  });

  afterEach(() => {
    if (savedRpc === undefined) delete process.env.WEB3_RPC_URL;
    else process.env.WEB3_RPC_URL = savedRpc;
  });

  it('accepts a genuine key-pair signature without touching the network', async () => {
    const wallet = Wallet.createRandom();
    const message = `Sign to verify ownership of wallet ${wallet.address} for Vouchit account abc123`;
    const signature = await wallet.signMessage(message);

    await expect(service.verifySignature(wallet.address, signature, message)).resolves.toBe(true);
  });

  it('rejects a signature over a different message', async () => {
    // Otherwise a signature captured from any other prompt would link a wallet.
    const wallet = Wallet.createRandom();
    const signature = await wallet.signMessage('something else entirely');
    const message = `Sign to verify ownership of wallet ${wallet.address} for Vouchit account abc123`;

    await expect(service.verifySignature(wallet.address, signature, message)).resolves.toBe(false);
  });

  it("rejects one wallet's signature presented as another wallet's", async () => {
    const signer = Wallet.createRandom();
    const victim = Wallet.createRandom();
    const message = `Sign to verify ownership of wallet ${victim.address} for Vouchit account abc123`;
    const signature = await signer.signMessage(message);

    await expect(service.verifySignature(victim.address, signature, message)).resolves.toBe(false);
  });

  it('does not accept a malformed signature through the ECDSA fast path', async () => {
    const wallet = Wallet.createRandom();
    const message = 'anything';

    await expect(service.verifySignature(wallet.address, '0xdeadbeef', message)).resolves.toBe(
      false,
    );
  });

  it('is async, so the contract-wallet path can be awaited', () => {
    // Guards the regression directly: when this returned a plain boolean,
    // `if (!isValid)` on a Promise was always falsy and every signature —
    // valid or not — would have passed had the call not been awaited.
    const wallet = Wallet.createRandom();
    const result = service.verifySignature(wallet.address, '0xdeadbeef', 'x');
    expect(typeof (result as any).then).toBe('function');
  });
});
