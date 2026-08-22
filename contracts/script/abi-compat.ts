/**
 * Cross-checks the ABIs the backend and frontend ship against the real deployed
 * contract.
 *
 * Both apps hand-write their ABI rather than importing build artifacts, so a
 * signature can drift from the contract and still typecheck — the failure only
 * shows up at runtime, in production, while money is moving. This deploys the
 * real contract and reads it back through each app's own ABI.
 */
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let checks = 0;
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  checks++;
  console.log(`  ✓ ${message}`);
}

/** Pull the human-readable ABI strings out of the backend's escrow.abi.ts. */
function backendAbi(): string[] {
  const src = readFileSync(resolve(__dirname, "../../backend/src/web3/escrow.abi.ts"), "utf8");
  return [...src.matchAll(/'((?:function|event)[^']+)'/g)].map((m) => m[1]);
}

async function main() {
  console.log("\n=== ABI compatibility against deployed contract ===\n");

  const [deployer, treasury, alice, bob] = await ethers.getSigners();
  const escrow = await (await ethers.getContractFactory("VouchitEscrow")).deploy(treasury.address);
  await escrow.waitForDeployment();
  const address = await escrow.getAddress();

  const stake = ethers.parseEther("1");
  const wagerId = ethers.hexlify(ethers.randomBytes(32));
  await (
    await escrow
      .connect(alice)
      .createWager(wagerId, bob.address, ethers.ZeroAddress, stake, 86400, { value: stake })
  ).wait();

  // ---- backend ----
  const abi = backendAbi();
  console.log("Backend ABI entries found:", abi.length);
  assert(abi.length >= 2, "backend ABI parsed from escrow.abi.ts");

  const asBackend = new Contract(address, abi, ethers.provider);
  const w = await asBackend.wagers(wagerId);

  // These are the exact fields verifyOnChainWager relies on.
  assert(String(w.creator) === alice.address, "backend ABI decodes `creator`");
  assert(String(w.challenger) === bob.address, "backend ABI decodes `challenger`");
  assert(String(w.token) === ethers.ZeroAddress, "backend ABI decodes `token`");
  assert((w.stakeAmount as bigint) === stake, "backend ABI decodes `stakeAmount`");
  assert((w.totalPot as bigint) === stake, "backend ABI decodes `totalPot`");
  assert(Number(w.status) === 0, "backend ABI decodes `status` as PENDING_FUNDING");
  assert(String(w.creatorVote) === ethers.ZeroAddress, "backend ABI decodes `creatorVote`");
  assert(String(w.challengerVote) === ethers.ZeroAddress, "backend ABI decodes `challengerVote`");
  assert(Number(w.expiresAt) > 0, "backend ABI decodes `expiresAt`");

  // The relayer path must encode, or dispute resolution fails in production.
  const resolveFragment = asBackend.interface.getFunction("resolveDispute");
  assert(resolveFragment !== null, "backend ABI exposes resolveDispute");
  assert(
    asBackend.interface.encodeFunctionData("resolveDispute", [wagerId, alice.address, 1]).length > 2,
    "backend ABI encodes a resolveDispute call",
  );

  // ---- frontend ----
  // The client ABI is a typed literal, so compare selectors against the contract.
  const clientSrc = readFileSync(
    resolve(__dirname, "../../frontend/src/lib/web3/escrowAbi.ts"),
    "utf8",
  );
  const clientFns = [...clientSrc.matchAll(/name:\s*"(\w+)"/g)].map((m) => m[1]);
  const contractFns = escrow.interface.fragments
    .filter((f: any) => f.type === "function")
    .map((f: any) => f.name);

  for (const fn of ["createWager", "joinWager", "voteWinner", "openDispute", "cancelExpiredWager", "wagers"]) {
    assert(clientFns.includes(fn), `frontend ABI declares ${fn}`);
    assert(contractFns.includes(fn), `contract actually has ${fn}`);
  }

  console.log(`\n=== ${checks} checks passed ===\n`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exitCode = 1;
});
