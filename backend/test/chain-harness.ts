/**
 * Boots a local EVM chain and deploys VouchitEscrow onto it, so the API can be
 * tested against a real contract rather than a mock.
 *
 * The backend reads the chain over JSON-RPC exactly as it would in production —
 * this is what proves verifyOnChainWager/verifyOnChainJoin and the settlement
 * mirror actually work end to end, which unit tests with a stubbed provider
 * cannot.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ContractFactory, JsonRpcProvider, Wallet, type Contract } from 'ethers';

const CONTRACTS_DIR = resolve(__dirname, '../../contracts');
const ARTIFACT = resolve(CONTRACTS_DIR, 'artifacts/src/VouchitEscrow.sol/VouchitEscrow.json');

/** Hardhat's deterministic dev mnemonic accounts — public, testnet-only keys. */
export const HARDHAT_KEYS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // #0 deployer/owner
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // #1 treasury
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // #2 alice
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', // #3 bob
];

export interface ChainHarness {
  rpcUrl: string;
  chainId: number;
  escrowAddress: string;
  provider: JsonRpcProvider;
  escrow: Contract;
  wallets: Wallet[];
  stop: () => Promise<void>;
}

async function waitForRpc(url: string, timeoutMs = 60_000): Promise<JsonRpcProvider> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      // cacheTimeout: -1 disables ethers' response cache. Without it, two
      // getBalance calls a moment apart return the identical cached value, so a
      // balance change across a transaction reads as zero.
      const provider = new JsonRpcProvider(url, undefined, {
        staticNetwork: true,
        cacheTimeout: -1,
      });
      await provider.getBlockNumber();
      return provider;
    } catch {
      if (Date.now() > deadline) throw new Error(`local chain not reachable at ${url}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

export async function startChain(port = 8546): Promise<ChainHarness> {
  if (!existsSync(ARTIFACT)) {
    throw new Error(
      `VouchitEscrow artifact missing. Run \`npm run compile\` in ${CONTRACTS_DIR} first.`,
    );
  }

  const node: ChildProcess = spawn(
    'npx',
    ['hardhat', 'node', '--port', String(port), '--hostname', '127.0.0.1'],
    { cwd: CONTRACTS_DIR, stdio: 'ignore' },
  );

  const rpcUrl = `http://127.0.0.1:${port}`;
  const provider = await waitForRpc(rpcUrl);
  const wallets = HARDHAT_KEYS.map((k) => new Wallet(k, provider));

  const artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'));
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallets[0]);
  const escrow = await factory.deploy(wallets[1].address); // wallet #1 is treasury
  await escrow.waitForDeployment();

  return {
    rpcUrl,
    chainId: 31337,
    escrowAddress: await escrow.getAddress(),
    provider,
    escrow: escrow as unknown as Contract,
    wallets,
    stop: async () => {
      node.kill('SIGKILL');
      await new Promise((r) => setTimeout(r, 300));
    },
  };
}
