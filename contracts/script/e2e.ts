/**
 * End-to-end run of the full wager lifecycle against a live chain.
 *
 * Unlike the unit tests, this deploys the contract and drives it exactly the way
 * the app does — separate signers per participant, real transactions, real
 * balance changes — so it catches wiring problems the unit tests can't.
 *
 *   Terminal 1:  npm run node
 *   Terminal 2:  npm run e2e
 */
import { ethers, network } from "hardhat";
import { formatEther, parseEther, type Signer } from "ethers";

const ONE_DAY = 24 * 60 * 60;
const STAKE = parseEther("1");

let step = 0;
const log = (msg: string) => console.log(`\n[${++step}] ${msg}`);
const detail = (msg: string) => console.log(`      ${msg}`);

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`      ✓ ${message}`);
}

const randomWagerId = () => ethers.hexlify(ethers.randomBytes(32));
const addr = (s: Signer & { address: string }) => s.address;

async function main() {
  console.log(`\n=== Vouchit escrow end-to-end (${network.name}) ===`);

  const [deployer, treasury, alice, bob] = await ethers.getSigners();

  log("Deploy VouchitEscrow");
  const escrow = await (await ethers.getContractFactory("VouchitEscrow")).deploy(treasury.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  detail(`escrow   ${escrowAddress}`);
  detail(`treasury ${treasury.address}`);
  detail(`alice    ${alice.address}`);
  detail(`bob      ${bob.address}`);

  // ---------------------------------------------------------------- happy path
  log("Alice creates an open wager, staking 1 ETH");
  const wagerId = randomWagerId();
  await (
    await escrow
      .connect(alice)
      .createWager(wagerId, ethers.ZeroAddress, ethers.ZeroAddress, STAKE, ONE_DAY, { value: STAKE })
  ).wait();

  let onChain = await escrow.wagers(wagerId);
  assert(onChain.creator === addr(alice), "escrow records Alice as creator");
  assert(onChain.stakeAmount === STAKE, "escrow holds the exact stake");
  assert(Number(onChain.status) === 0, "wager is PENDING_FUNDING");
  assert(
    (await ethers.provider.getBalance(escrowAddress)) === STAKE,
    "contract balance equals one stake",
  );

  log("Bob joins, matching the stake");
  await (await escrow.connect(bob).joinWager(wagerId, { value: STAKE })).wait();

  onChain = await escrow.wagers(wagerId);
  assert(onChain.challenger === addr(bob), "escrow records Bob as challenger");
  assert(Number(onChain.status) === 1, "wager is ACTIVE");
  assert(onChain.totalPot === STAKE * 2n, "pot is both stakes");

  log("Both vote for Bob — the contract should settle itself");
  await (await escrow.connect(alice).voteWinner(wagerId, addr(bob))).wait();

  onChain = await escrow.wagers(wagerId);
  assert(Number(onChain.status) === 1, "one vote alone does not settle it");

  const bobBefore = await ethers.provider.getBalance(bob.address);
  const treasuryBefore = await ethers.provider.getBalance(treasury.address);

  const settleTx = await escrow.connect(bob).voteWinner(wagerId, addr(bob));
  const receipt = await settleTx.wait();
  const gasSpent = receipt!.gasUsed * receipt!.gasPrice;

  const pot = STAKE * 2n;
  const expectedFee = (pot * 250n) / 10_000n;
  const expectedPayout = pot - expectedFee;

  onChain = await escrow.wagers(wagerId);
  assert(Number(onChain.status) === 2, "wager is SETTLED");
  assert(onChain.winner === addr(bob), "Bob is recorded as winner");

  const bobGained = (await ethers.provider.getBalance(bob.address)) - bobBefore + gasSpent;
  const treasuryGained = (await ethers.provider.getBalance(treasury.address)) - treasuryBefore;

  detail(`payout   ${formatEther(expectedPayout)} ETH`);
  detail(`fee      ${formatEther(expectedFee)} ETH`);
  assert(bobGained === expectedPayout, "Bob received the pot less the 2.5% fee");
  assert(treasuryGained === expectedFee, "treasury received the fee");
  assert(
    (await ethers.provider.getBalance(escrowAddress)) === 0n,
    "contract holds nothing afterwards",
  );

  // ------------------------------------------------------------------- dispute
  log("Disputed wager: Alice and Bob disagree, admin resolves for Alice");
  const disputedId = randomWagerId();
  await (
    await escrow
      .connect(alice)
      .createWager(disputedId, ethers.ZeroAddress, ethers.ZeroAddress, STAKE, ONE_DAY, { value: STAKE })
  ).wait();
  await (await escrow.connect(bob).joinWager(disputedId, { value: STAKE })).wait();

  await (await escrow.connect(alice).voteWinner(disputedId, addr(alice))).wait();
  await (await escrow.connect(bob).voteWinner(disputedId, addr(bob))).wait();
  assert(Number((await escrow.wagers(disputedId)).status) === 1, "conflicting votes leave it ACTIVE");

  await (await escrow.connect(bob).openDispute(disputedId)).wait();
  assert(Number((await escrow.wagers(disputedId)).status) === 3, "wager is DISPUTED");

  const aliceBefore = await ethers.provider.getBalance(alice.address);
  // resolveDispute is onlyOwner — this is the relayer path the backend uses.
  await (await escrow.connect(deployer).resolveDispute(disputedId, addr(alice), 1)).wait();

  assert(Number((await escrow.wagers(disputedId)).status) === 2, "dispute resolved to SETTLED");
  assert(
    (await ethers.provider.getBalance(alice.address)) - aliceBefore === expectedPayout,
    "Alice received the disputed payout",
  );

  log("Non-owner cannot resolve a dispute");
  const rogueId = randomWagerId();
  await (
    await escrow
      .connect(alice)
      .createWager(rogueId, ethers.ZeroAddress, ethers.ZeroAddress, STAKE, ONE_DAY, { value: STAKE })
  ).wait();
  await (await escrow.connect(bob).joinWager(rogueId, { value: STAKE })).wait();

  let rejected = false;
  try {
    await escrow.connect(bob).resolveDispute(rogueId, addr(bob), 1);
  } catch {
    rejected = true;
  }
  assert(rejected, "a participant cannot resolve their own dispute");

  // -------------------------------------------------------------------- expiry
  log("Unjoined wager expires and refunds its creator");
  const expiringId = randomWagerId();
  await (
    await escrow
      .connect(alice)
      .createWager(expiringId, ethers.ZeroAddress, ethers.ZeroAddress, STAKE, 60, { value: STAKE })
  ).wait();

  await network.provider.send("evm_increaseTime", [120]);
  await network.provider.send("evm_mine");

  const refundBefore = await ethers.provider.getBalance(alice.address);
  await (await escrow.connect(bob).cancelExpiredWager(expiringId)).wait();
  assert(
    (await ethers.provider.getBalance(alice.address)) - refundBefore === STAKE,
    "creator got the full stake back, no fee taken",
  );

  console.log(`\n=== All ${step} stages passed ===`);
  console.log(`\nVOUCHIT_ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exitCode = 1;
});
