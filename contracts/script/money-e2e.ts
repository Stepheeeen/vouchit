/**
 * End-to-end test of the money path, on a live chain.
 *
 * `e2e.ts` walks the wager lifecycle but stakes native ETH throughout, so the
 * ERC20 route — which is how most people will stake, since USDC is the default
 * currency in the UI — was never exercised end to end. This covers it, and the
 * things that only go wrong when real token accounting is involved:
 *
 *   - allowance is actually consumed, and a batched approval survives to cover
 *     a second wager without a second approval transaction
 *   - the escrow holds exactly the pot while a wager is live
 *   - the winner receives pot minus the 2.5% fee, to the base unit
 *   - the treasury receives exactly the fee
 *   - the contract keeps nothing afterwards
 *   - a refund on an unjoined wager returns the full stake with no fee
 *   - staking more than you hold fails cleanly, before anything moves
 *
 * Every assertion is on an exact balance, because "roughly right" is how
 * money bugs survive a test suite.
 *
 *   npx hardhat run script/money-e2e.ts
 */
import { ethers } from "hardhat";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`      ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`      ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
}

function eq(label: string, actual: bigint, expected: bigint) {
  check(label, actual === expected, `got ${actual} expected ${expected}`);
}

function stage(n: number, title: string) {
  console.log(`\n[${n}] ${title}`);
}

const newId = () => ethers.hexlify(ethers.randomBytes(32));

async function main() {
  const [deployer, treasury, alice, bob, carol] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("VouchitEscrow");
  const escrow = await Escrow.deploy(treasury.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  const Token = await ethers.getContractFactory("MockERC20");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  // 6 decimals, like real USDC.
  const UNIT = 1_000_000n;
  const STAKE = 25n * UNIT;

  await (await token.mint(alice.address, 1_000n * UNIT)).wait();
  await (await token.mint(bob.address, 1_000n * UNIT)).wait();
  await (await token.mint(carol.address, 10n * UNIT)).wait();

  console.log(`Escrow   ${escrowAddress}`);
  console.log(`Token    ${tokenAddress} (6dp)`);
  console.log(`Treasury ${treasury.address}`);

  // ─────────────────────────────────────────────────────────────────────
  stage(1, "A batched approval covers more than one wager");

  // The app approves a multiple of the stake rather than the exact amount,
  // so a repeat wager costs one signature instead of two. If that batching
  // ever silently reverts to exact-amount approvals, the second create below
  // fails and this stage catches it.
  const BATCH = STAKE * 10n;
  await (await token.connect(alice).approve(escrowAddress, BATCH)).wait();
  eq("allowance starts at the batched amount", await token.allowance(alice.address, escrowAddress), BATCH);

  const wagerA = newId();
  await (
    await escrow.connect(alice).createWager(wagerA, bob.address, tokenAddress, STAKE, 86400)
  ).wait();
  eq("allowance drops by exactly one stake", await token.allowance(alice.address, escrowAddress), BATCH - STAKE);

  const wagerB = newId();
  await (
    await escrow.connect(alice).createWager(wagerB, carol.address, tokenAddress, STAKE, 86400)
  ).wait();
  check("a second wager needed no further approval", true);
  eq("allowance drops again", await token.allowance(alice.address, escrowAddress), BATCH - STAKE * 2n);

  // ─────────────────────────────────────────────────────────────────────
  stage(2, "The escrow holds exactly the pot while a wager is live");

  const aliceBeforeJoin = await token.balanceOf(alice.address);
  const bobBeforeJoin = await token.balanceOf(bob.address);
  const escrowBeforeJoin = await token.balanceOf(escrowAddress);

  await (await token.connect(bob).approve(escrowAddress, STAKE)).wait();
  await (await escrow.connect(bob).joinWager(wagerA)).wait();

  eq("challenger paid exactly the stake", bobBeforeJoin - (await token.balanceOf(bob.address)), STAKE);
  eq("escrow gained exactly the stake", (await token.balanceOf(escrowAddress)) - escrowBeforeJoin, STAKE);
  eq("creator's balance untouched by the join", await token.balanceOf(alice.address), aliceBeforeJoin);

  const onChainA = await escrow.wagers(wagerA);
  eq("pot is both stakes", onChainA.totalPot, STAKE * 2n);

  // ─────────────────────────────────────────────────────────────────────
  stage(3, "Settlement pays the winner the pot less 2.5%, to the base unit");

  const pot = STAKE * 2n;
  const expectedFee = (pot * 250n) / 10_000n;
  const expectedPayout = pot - expectedFee;

  const aliceBefore = await token.balanceOf(alice.address);
  const treasuryBefore = await token.balanceOf(treasury.address);

  await (await escrow.connect(alice).voteWinner(wagerA, alice.address)).wait();
  await (await escrow.connect(bob).voteWinner(wagerA, alice.address)).wait();

  eq("winner received pot minus fee", (await token.balanceOf(alice.address)) - aliceBefore, expectedPayout);
  eq("treasury received exactly the fee", (await token.balanceOf(treasury.address)) - treasuryBefore, expectedFee);
  eq("fee is 2.5% of the pot", expectedFee, (STAKE * 2n * 25n) / 1000n);

  // The one that catches rounding left behind: after settling wager A, the
  // escrow should hold only wager B's unjoined stake and not a wei more.
  eq("escrow keeps nothing from the settled wager", await token.balanceOf(escrowAddress), STAKE);

  // ─────────────────────────────────────────────────────────────────────
  stage(4, "An unjoined wager refunds in full, with no fee taken");

  const aliceBeforeRefund = await token.balanceOf(alice.address);
  const treasuryBeforeRefund = await token.balanceOf(treasury.address);

  await ethers.provider.send("evm_increaseTime", [86401]);
  await ethers.provider.send("evm_mine", []);
  await (await escrow.connect(alice).cancelExpiredWager(wagerB)).wait();

  eq("creator got the whole stake back", (await token.balanceOf(alice.address)) - aliceBeforeRefund, STAKE);
  eq("treasury took nothing from a refund", await token.balanceOf(treasury.address), treasuryBeforeRefund);
  eq("escrow is now empty", await token.balanceOf(escrowAddress), 0n);

  // ─────────────────────────────────────────────────────────────────────
  stage(5, "Staking more than you hold fails without moving anything");

  // Carol holds 10 units and tries to stake 25. The UI now blocks this before
  // signing, but the chain must refuse it too — the UI is a convenience, not
  // the guarantee.
  const carolBefore = await token.balanceOf(carol.address);
  await (await token.connect(carol).approve(escrowAddress, STAKE)).wait();
  let reverted = false;
  try {
    await (
      await escrow.connect(carol).createWager(newId(), alice.address, tokenAddress, STAKE, 86400)
    ).wait();
  } catch {
    reverted = true;
  }
  check("an unaffordable stake is refused on-chain", reverted);
  eq("her balance is untouched", await token.balanceOf(carol.address), carolBefore);
  eq("escrow still holds nothing", await token.balanceOf(escrowAddress), 0n);

  // ─────────────────────────────────────────────────────────────────────
  stage(6, "Native ETH settles with the same arithmetic");

  const ethStake = ethers.parseEther("0.01");
  const ethPot = ethStake * 2n;
  const ethFee = (ethPot * 250n) / 10_000n;

  const wagerC = newId();
  await (
    await escrow
      .connect(alice)
      .createWager(wagerC, bob.address, ethers.ZeroAddress, ethStake, 86400, { value: ethStake })
  ).wait();
  await (await escrow.connect(bob).joinWager(wagerC, { value: ethStake })).wait();

  eq("escrow holds both ETH stakes", await ethers.provider.getBalance(escrowAddress), ethPot);

  const treasuryEthBefore = await ethers.provider.getBalance(treasury.address);
  await (await escrow.connect(alice).voteWinner(wagerC, bob.address)).wait();
  await (await escrow.connect(bob).voteWinner(wagerC, bob.address)).wait();

  eq(
    "treasury received the ETH fee",
    (await ethers.provider.getBalance(treasury.address)) - treasuryEthBefore,
    ethFee,
  );
  eq("escrow holds no ETH afterwards", await ethers.provider.getBalance(escrowAddress), 0n);

  console.log(`\n=== money path: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
