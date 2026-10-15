/**
 * Pre-flight check for a configured deployment.
 *
 * Run this against staging and again against mainnet before letting anyone in.
 * It verifies the things that typecheck fine and fail with money on the line:
 * that the configured address really holds the escrow, that the relayer holds
 * ownership (nothing else can resolve a dispute), that the treasury on-chain is
 * the one you think it is, and that the fee matches what the UI promises.
 *
 *   npx hardhat run script/preflight.ts --network baseSepolia
 *   npx hardhat run script/preflight.ts --network base
 */
import { ethers, network } from 'hardhat';

let failures = 0;
let checks = 0;

function check(ok: boolean, label: string, detail = '') {
  checks++;
  if (ok) {
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`);
  }
}

async function main() {
  const address = process.env.VOUCHIT_ESCROW_CONTRACT_ADDRESS;
  const treasury = process.env.TREASURY_ADDRESS;
  const relayerKey = process.env.ADMIN_RELAYER_PRIVATE_KEY;

  console.log(`\n=== Vouchit pre-flight (${network.name}) ===\n`);

  console.log('Configuration');
  check(!!address && ethers.isAddress(address), 'VOUCHIT_ESCROW_CONTRACT_ADDRESS is a valid address', address ?? '(unset)');
  check(!!treasury && ethers.isAddress(treasury), 'TREASURY_ADDRESS is a valid address', treasury ?? '(unset)');
  check(!!relayerKey, 'ADMIN_RELAYER_PRIVATE_KEY is set');
  if (failures) {
    console.log('\nStopping: fix the configuration before the on-chain checks.\n');
    process.exitCode = 1;
    return;
  }

  const expectedChainId = network.name === 'base' ? 8453n : network.name === 'baseSepolia' ? 84532n : null;
  const net = await ethers.provider.getNetwork();

  console.log('\nNetwork');
  check(
    expectedChainId === null || net.chainId === expectedChainId,
    'RPC chain id matches the selected network',
    `rpc=${net.chainId}${expectedChainId !== null ? ` expected=${expectedChainId}` : ''}`,
  );

  console.log('\nContract');
  const code = await ethers.provider.getCode(address!);
  check(code !== '0x', 'a contract exists at that address', `${(code.length - 2) / 2} bytes`);
  if (code === '0x') {
    console.log('\nStopping: nothing deployed there.\n');
    process.exitCode = 1;
    return;
  }

  const escrow = await ethers.getContractAt('VouchitEscrow', address!);

  // A wrong ABI or a different contract at this address shows up here.
  let onChainOwner: string;
  let onChainTreasury: string;
  let feeBps: bigint;
  try {
    [onChainOwner, onChainTreasury, feeBps] = await Promise.all([
      escrow.owner(),
      escrow.treasury(),
      escrow.PROTOCOL_FEE_BPS(),
    ]);
  } catch {
    check(false, 'the contract answers the VouchitEscrow interface');
    console.log('\nStopping: the address holds something else.\n');
    process.exitCode = 1;
    return;
  }
  check(true, 'the contract answers the VouchitEscrow interface');

  const relayer = new ethers.Wallet(relayerKey!);
  check(
    onChainOwner.toLowerCase() === relayer.address.toLowerCase(),
    'the relayer key owns the contract (only the owner can resolve disputes)',
    `owner=${onChainOwner} relayer=${relayer.address}`,
  );
  check(
    onChainTreasury.toLowerCase() === treasury!.toLowerCase(),
    'the on-chain treasury matches TREASURY_ADDRESS',
    `on-chain=${onChainTreasury}`,
  );
  check(feeBps === 250n, 'the protocol fee is the 2.5% the UI promises', `${feeBps} bps`);

  console.log('\nRelayer');
  const relayerBalance = await ethers.provider.getBalance(relayer.address);
  // Dispute resolution is a transaction; an empty relayer cannot settle one.
  check(
    relayerBalance > ethers.parseEther('0.001'),
    'the relayer holds gas to resolve disputes',
    `${ethers.formatEther(relayerBalance)} ETH`,
  );

  console.log(`\n=== ${checks - failures}/${checks} passed ===\n`);
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exitCode = 1;
});
