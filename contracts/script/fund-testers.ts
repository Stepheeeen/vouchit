/**
 * Tops up tester wallets with testnet ETH.
 *
 * Vouchit is a wagering app: a tester who signs in with a passkey and has an
 * empty wallet cannot create or join anything. Sending them to three separate
 * faucets before they see the product is how early feedback dies, so the
 * relayer funds them directly instead.
 *
 * Usage:
 *   npx hardhat run script/fund-testers.ts --network baseSepolia
 *
 * Addresses come from TESTER_ADDRESSES (comma-separated) or testers.txt, one
 * per line, blank lines and #-comments ignored.
 */
import { ethers, network } from 'hardhat';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Enough for many wagers plus gas, but worthless if the list leaks. */
const TOP_UP_TO = ethers.parseEther('0.02');

function readTesterAddresses(): string[] {
  const fromEnv = process.env.TESTER_ADDRESSES;
  const raw = fromEnv
    ? fromEnv.split(',')
    : existsSync(resolve(__dirname, '../testers.txt'))
      ? readFileSync(resolve(__dirname, '../testers.txt'), 'utf8').split('\n')
      : [];

  const addresses = raw
    .map((line) => line.split('#')[0].trim())
    .filter(Boolean);

  const invalid = addresses.filter((a) => !ethers.isAddress(a));
  if (invalid.length) {
    throw new Error(`Not valid addresses: ${invalid.join(', ')}`);
  }
  // De-duplicate case-insensitively so a repeated address is funded once.
  return [...new Map(addresses.map((a) => [a.toLowerCase(), a])).values()];
}

async function main() {
  if (network.name === 'base') {
    throw new Error('Refusing to run against Base mainnet — this sends real funds.');
  }

  const addresses = readTesterAddresses();
  if (!addresses.length) {
    throw new Error('No tester addresses. Set TESTER_ADDRESSES or create contracts/testers.txt.');
  }

  const [relayer] = await ethers.getSigners();
  const relayerBalance = await ethers.provider.getBalance(relayer.address);

  console.log(`Network:  ${network.name}`);
  console.log(`Funder:   ${relayer.address}`);
  console.log(`Balance:  ${ethers.formatEther(relayerBalance)} ETH`);
  console.log(`Testers:  ${addresses.length}\n`);

  // Work out the real cost before sending anything, so we fail before a
  // half-funded run rather than during one.
  const plan: Array<{ address: string; amount: bigint }> = [];
  for (const address of addresses) {
    const balance = await ethers.provider.getBalance(address);
    if (balance >= TOP_UP_TO) {
      console.log(`  skip  ${address}  already has ${ethers.formatEther(balance)} ETH`);
      continue;
    }
    plan.push({ address, amount: TOP_UP_TO - balance });
  }

  if (!plan.length) {
    console.log('\nEveryone is already funded.');
    return;
  }

  const total = plan.reduce((sum, p) => sum + p.amount, 0n);
  const headroom = ethers.parseEther('0.002'); // leave gas for the transfers
  if (relayerBalance < total + headroom) {
    throw new Error(
      `Need ~${ethers.formatEther(total + headroom)} ETH but the funder holds ` +
        `${ethers.formatEther(relayerBalance)}. Top it up from a faucet first.`,
    );
  }

  for (const { address, amount } of plan) {
    const tx = await relayer.sendTransaction({ to: address, value: amount });
    await tx.wait();
    console.log(`  sent  ${ethers.formatEther(amount).padEnd(8)} ETH -> ${address}`);
  }

  console.log(`\nFunded ${plan.length} tester(s). Remaining: ${ethers.formatEther(await ethers.provider.getBalance(relayer.address))} ETH`);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exitCode = 1;
});
