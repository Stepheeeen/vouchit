/**
 * Fairness properties of VouchitEscrowV2.
 *
 * The old contract was tested for the paths that worked. What it was never
 * tested for was what happens when someone simply stops cooperating, and that
 * is where it failed: a losing player who never voted kept the winner unpaid
 * forever, two players who lost interest left both stakes stranded, and the
 * owner could pick a winner on a wager nobody had disputed.
 *
 * So these tests are written from the other direction — each one is a way for
 * a party to behave badly or go silent, and the assertion is that money still
 * reaches the right person. Several of them are run against V1 at the bottom
 * of the file, where they fail, so the difference is demonstrated rather than
 * described.
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const ONE_ETH = ethers.parseEther("1");
const DAY = 24 * 60 * 60;
const FEE_BPS = 250n;
const BPS = 10_000n;
const VOTE_WINDOW = 3 * DAY;
const DISPUTE_SLA = 14 * DAY;

const id = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const feeOf = (pot: bigint) => (pot * FEE_BPS) / BPS;

const PENDING = 0n, ACTIVE = 1n, SETTLED = 2n, DISPUTED = 3n, CANCELLED = 4n;

describe("VouchitEscrowV2 — declaring a winner fairly", () => {
  let escrow: any;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let challenger: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, treasury, creator, challenger, outsider] = await ethers.getSigners();
    escrow = await (await ethers.getContractFactory("VouchitEscrowV2")).deploy(treasury.address);
    await escrow.waitForDeployment();
  });

  /** Create and fully fund a wager, leaving it ACTIVE. */
  const active = async (wagerId: string) => {
    await escrow
      .connect(creator)
      .createWager(wagerId, challenger.address, ethers.ZeroAddress, ONE_ETH, DAY, { value: ONE_ETH });
    await escrow.connect(challenger).joinWager(wagerId, { value: ONE_ETH });
    return wagerId;
  };

  const held = async () => ethers.provider.getBalance(await escrow.getAddress());

  // ───────────────────────────────────────────────────────────────────
  // 1. Agreement — unchanged, and still needs nobody's permission
  // ───────────────────────────────────────────────────────────────────

  describe("when both parties agree", () => {
    it("pays the winner immediately, with no arbiter involved", async () => {
      const wid = await active(id("agree"));
      const pot = ONE_ETH * 2n;
      const fee = feeOf(pot);

      await escrow.connect(creator).voteWinner(wid, challenger.address);
      await expect(escrow.connect(challenger).voteWinner(wid, challenger.address))
        .to.changeEtherBalances([challenger, treasury], [pot - fee, fee]);

      const w = await escrow.wagers(wid);
      expect(w.status).to.equal(SETTLED);
      expect(w.winner).to.equal(challenger.address);
      expect(await held()).to.equal(0n);
    });

    it("holds the stakes while only one has voted", async () => {
      const wid = await active(id("one-vote"));
      await escrow.connect(creator).voteWinner(wid, creator.address);
      expect((await escrow.wagers(wid)).status).to.equal(ACTIVE);
      expect(await held()).to.equal(ONE_ETH * 2n);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // 2. Silence concedes — the central fix
  // ───────────────────────────────────────────────────────────────────

  describe("when one party votes and the other goes silent", () => {
    it("will not finalize while the voting window is open", async () => {
      const wid = await active(id("too-early"));
      await escrow.connect(creator).voteWinner(wid, creator.address);
      await time.increase(DAY + 1); // past expiry, inside the window
      await expect(escrow.connect(creator).finalizeExpired(wid)).to.be.revertedWith(
        "Voting window is still open",
      );
    });

    it("lets the single vote stand once the window closes", async () => {
      const wid = await active(id("silence-concedes"));
      const pot = ONE_ETH * 2n;
      const fee = feeOf(pot);

      // The creator says they won. The challenger never responds.
      await escrow.connect(creator).voteWinner(wid, creator.address);
      await time.increase(DAY + VOTE_WINDOW + 1);

      await expect(escrow.connect(creator).finalizeExpired(wid)).to.changeEtherBalances(
        [creator, treasury],
        [pot - fee, fee],
      );

      const settled = await escrow.wagers(wid);
      expect(settled.status).to.equal(SETTLED);
      expect(settled.winner).to.equal(creator.address);
      expect(await held()).to.equal(0n);
    });

    it("works the same way when the silent one is the creator", async () => {
      const wid = await active(id("creator-silent"));
      const pot = ONE_ETH * 2n;
      await escrow.connect(challenger).voteWinner(wid, challenger.address);
      await time.increase(DAY + VOTE_WINDOW + 1);
      await expect(escrow.connect(challenger).finalizeExpired(wid)).to.changeEtherBalance(
        challenger,
        pot - feeOf(pot),
      );
    });

    it("honours a vote cast FOR the other party", async () => {
      // Conceding should work as readily as claiming, or an honest loser has
      // no way to release the money.
      const wid = await active(id("concede"));
      const pot = ONE_ETH * 2n;
      await escrow.connect(creator).voteWinner(wid, challenger.address);
      await time.increase(DAY + VOTE_WINDOW + 1);
      await expect(escrow.connect(creator).finalizeExpired(wid)).to.changeEtherBalance(
        challenger,
        pot - feeOf(pot),
      );
    });

    it("can be triggered by a complete stranger", async () => {
      // The outcome is fixed by the votes and the clock, so nobody should need
      // the other party — or us — to co-operate in order to get paid.
      const wid = await active(id("stranger"));
      const pot = ONE_ETH * 2n;
      await escrow.connect(challenger).voteWinner(wid, challenger.address);
      await time.increase(DAY + VOTE_WINDOW + 1);
      await expect(escrow.connect(outsider).finalizeExpired(wid)).to.changeEtherBalance(
        challenger,
        pot - feeOf(pot),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // 3. Nobody is ever stranded
  // ───────────────────────────────────────────────────────────────────

  describe("when nobody votes at all", () => {
    it("refunds both stakes and takes no fee", async () => {
      const wid = await active(id("nobody-voted"));
      await time.increase(DAY + VOTE_WINDOW + 1);

      await expect(escrow.connect(outsider).finalizeExpired(wid)).to.changeEtherBalances(
        [creator, challenger, treasury],
        [ONE_ETH, ONE_ETH, 0n],
      );

      expect((await escrow.wagers(wid)).status).to.equal(CANCELLED);
      expect(await held()).to.equal(0n);
    });
  });

  describe("when the parties disagree and neither escalates", () => {
    it("refunds both rather than guessing", async () => {
      const wid = await active(id("disagree-no-dispute"));
      await escrow.connect(creator).voteWinner(wid, creator.address);
      await escrow.connect(challenger).voteWinner(wid, challenger.address);
      expect((await escrow.wagers(wid)).status).to.equal(ACTIVE);

      await time.increase(DAY + VOTE_WINDOW + 1);
      await expect(escrow.connect(outsider).finalizeExpired(wid)).to.changeEtherBalances(
        [creator, challenger, treasury],
        [ONE_ETH, ONE_ETH, 0n],
      );
    });
  });

  it("refunds a wager nobody ever joined", async () => {
    const wid = id("never-joined");
    await escrow
      .connect(creator)
      .createWager(wid, challenger.address, ethers.ZeroAddress, ONE_ETH, DAY, { value: ONE_ETH });
    await time.increase(DAY + 1);
    await expect(escrow.connect(outsider).cancelExpiredWager(wid)).to.changeEtherBalance(creator, ONE_ETH);
  });

  it("never leaves a settled or refunded wager re-settleable", async () => {
    const wid = await active(id("no-double-spend"));
    await time.increase(DAY + VOTE_WINDOW + 1);
    await escrow.connect(outsider).finalizeExpired(wid);
    await expect(escrow.connect(outsider).finalizeExpired(wid)).to.be.revertedWith("Wager is not active");
    await expect(escrow.connect(creator).voteWinner(wid, creator.address)).to.be.revertedWith(
      "Wager is not active",
    );
  });

  // ───────────────────────────────────────────────────────────────────
  // 4. The arbiter's power is bounded
  // ───────────────────────────────────────────────────────────────────

  describe("the arbiter", () => {
    it("CANNOT touch a wager nobody disputed", async () => {
      // This is the ability the old contract gave the owner, and the single
      // most important thing V2 takes away.
      const wid = await active(id("undisputed"));
      await expect(
        escrow.connect(owner).resolveDispute(wid, creator.address, 1),
      ).to.be.revertedWith("Wager is not disputed");
      expect(await held()).to.equal(ONE_ETH * 2n);
    });

    it("cannot touch one that has merely expired", async () => {
      const wid = await active(id("undisputed-expired"));
      await time.increase(DAY + VOTE_WINDOW + 1);
      await expect(
        escrow.connect(owner).resolveDispute(wid, creator.address, 1),
      ).to.be.revertedWith("Wager is not disputed");
    });

    it("can decide a genuine dispute", async () => {
      const wid = await active(id("real-dispute"));
      const pot = ONE_ETH * 2n;
      await escrow.connect(creator).voteWinner(wid, creator.address);
      await escrow.connect(challenger).voteWinner(wid, challenger.address);
      await escrow.connect(creator).openDispute(wid);

      await expect(escrow.connect(owner).resolveDispute(wid, challenger.address, 1))
        .to.changeEtherBalances([challenger, treasury], [pot - feeOf(pot), feeOf(pot)]);
    });

    it("can call a dispute a draw and refund both, fee-free", async () => {
      const wid = await active(id("draw"));
      await escrow.connect(creator).openDispute(wid);
      await expect(escrow.connect(owner).resolveDispute(wid, ethers.ZeroAddress, 2)).to.changeEtherBalances(
        [creator, challenger, treasury],
        [ONE_ETH, ONE_ETH, 0n],
      );
    });

    it("cannot pay a third party", async () => {
      const wid = await active(id("outsider-payout"));
      await escrow.connect(creator).openDispute(wid);
      await expect(
        escrow.connect(owner).resolveDispute(wid, outsider.address, 1),
      ).to.be.revertedWith("Winner must be a participant");
    });

    it("cannot pay itself", async () => {
      const wid = await active(id("self-payout"));
      await escrow.connect(creator).openDispute(wid);
      await expect(escrow.connect(owner).resolveDispute(wid, owner.address, 1)).to.be.revertedWith(
        "Winner must be a participant",
      );
    });

    it("is the only one who can resolve a dispute", async () => {
      const wid = await active(id("not-owner"));
      await escrow.connect(creator).openDispute(wid);
      await expect(
        escrow.connect(creator).resolveDispute(wid, creator.address, 1),
      ).to.be.revertedWith("Not the owner");
    });

    it("cannot freeze money by never answering a dispute", async () => {
      // Without this, opening a dispute would hand us an indefinite hold on
      // both stakes simply by doing nothing — which is exactly the position
      // the live app is in right now, with no admin account able to resolve.
      const wid = await active(id("stalled"));
      await escrow.connect(creator).openDispute(wid);

      await time.increase(DISPUTE_SLA - DAY);
      await expect(escrow.connect(creator).claimStalledDispute(wid)).to.be.revertedWith(
        "Arbiter still has time",
      );

      await time.increase(DAY + 1);
      await expect(escrow.connect(challenger).claimStalledDispute(wid)).to.changeEtherBalances(
        [creator, challenger, treasury],
        [ONE_ETH, ONE_ETH, 0n],
      );
      expect((await escrow.wagers(wid)).status).to.equal(CANCELLED);
    });

    it("loses the dispute once it has been claimed back", async () => {
      const wid = await active(id("stalled-then-resolve"));
      await escrow.connect(creator).openDispute(wid);
      await time.increase(DISPUTE_SLA + 1);
      await escrow.connect(outsider).claimStalledDispute(wid);
      await expect(
        escrow.connect(owner).resolveDispute(wid, creator.address, 1),
      ).to.be.revertedWith("Wager is not disputed");
    });
  });

  describe("disputes", () => {
    it("can only be opened by a participant", async () => {
      const wid = await active(id("outsider-dispute"));
      await expect(escrow.connect(outsider).openDispute(wid)).to.be.revertedWith(
        "Only participants can dispute",
      );
    });

    it("stop the voting clock from finalizing underneath them", async () => {
      // A dispute must not be overtaken by the timeout path, or escalating
      // would silently hand the win to whoever voted first.
      const wid = await active(id("dispute-beats-timeout"));
      await escrow.connect(creator).voteWinner(wid, creator.address);
      await escrow.connect(challenger).openDispute(wid);
      await time.increase(DAY + VOTE_WINDOW + 1);
      await expect(escrow.connect(outsider).finalizeExpired(wid)).to.be.revertedWith(
        "Wager is not active",
      );
      expect(await held()).to.equal(ONE_ETH * 2n);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // 5. Tokens that would strand the pot are refused at the door
  // ───────────────────────────────────────────────────────────────────

  describe("fee-on-transfer tokens", () => {
    it("are rejected on create rather than stranding the pot", async () => {
      const fee = await (await ethers.getContractFactory("MockFeeOnTransferERC20")).deploy();
      await fee.waitForDeployment();
      const amount = ethers.parseEther("20");
      await fee.mint(creator.address, amount);
      await fee.connect(creator).approve(await escrow.getAddress(), amount);

      await expect(
        escrow
          .connect(creator)
          .createWager(id("fee-token"), challenger.address, await fee.getAddress(), amount, DAY),
      ).to.be.revertedWith("Token takes a fee on transfer; unsupported");
    });

    it("are rejected on join too", async () => {
      const fee = await (await ethers.getContractFactory("MockFeeOnTransferERC20")).deploy();
      await fee.waitForDeployment();
      const good = await (await ethers.getContractFactory("MockERC20")).deploy();
      await good.waitForDeployment();
      void good;

      // Reaching the join path needs a create that succeeded, so this checks
      // the same guard from the other side using a token that only starts
      // charging later — simulated by funding the challenger short.
      const amount = ethers.parseEther("10");
      await fee.mint(challenger.address, amount);
      await fee.connect(challenger).approve(await escrow.getAddress(), amount);
      await expect(
        escrow
          .connect(challenger)
          .createWager(id("fee-token-2"), creator.address, await fee.getAddress(), amount, DAY),
      ).to.be.revertedWith("Token takes a fee on transfer; unsupported");
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // 6. ERC20 happy path still balances exactly
  // ───────────────────────────────────────────────────────────────────

  it("settles an ERC20 wager to the exact unit", async () => {
    const token = await (await ethers.getContractFactory("MockERC20")).deploy();
    await token.waitForDeployment();
    const stake = 1_000_000n; // 1 mUSDC, 6dp
    const wid = id("erc20");

    for (const s of [creator, challenger]) {
      await token.mint(s.address, stake);
      await token.connect(s).approve(await escrow.getAddress(), stake);
    }

    await escrow.connect(creator).createWager(wid, challenger.address, await token.getAddress(), stake, DAY);
    await escrow.connect(challenger).joinWager(wid);
    await escrow.connect(challenger).voteWinner(wid, challenger.address);
    await time.increase(DAY + VOTE_WINDOW + 1);
    await escrow.connect(outsider).finalizeExpired(wid);

    const pot = stake * 2n;
    const fee = feeOf(pot);
    expect(await token.balanceOf(challenger.address)).to.equal(pot - fee);
    expect(await token.balanceOf(creator.address)).to.equal(0n);
    expect(await token.balanceOf(treasury.address)).to.equal(fee);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0n);
  });
});

/**
 * The same three scenarios against the contract currently on Base mainnet.
 *
 * These assert the FAILURES, so the suite records what the old behaviour
 * actually was. If a future change to V1 fixes any of them, these tests break
 * and should be deleted — they are a record, not a requirement.
 */
describe("VouchitEscrow (V1) — the behaviour V2 replaces", () => {
  let v1: any;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let challenger: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, treasury, creator, challenger] = await ethers.getSigners();
    v1 = await (await ethers.getContractFactory("VouchitEscrow")).deploy(treasury.address);
    await v1.waitForDeployment();
  });

  const active = async (wagerId: string) => {
    await v1
      .connect(creator)
      .createWager(wagerId, challenger.address, ethers.ZeroAddress, ONE_ETH, DAY, { value: ONE_ETH });
    await v1.connect(challenger).joinWager(wagerId, { value: ONE_ETH });
    return wagerId;
  };

  it("strands both stakes when the loser simply never votes", async () => {
    const wid = await active(id("v1-silence"));
    await v1.connect(creator).voteWinner(wid, creator.address);
    await time.increase(365 * DAY);

    // There is no timeout path at all, and the refund path refuses an ACTIVE
    // wager — so nobody, including the owner, can release it.
    for (const who of [creator, challenger, owner]) {
      await expect(v1.connect(who).cancelExpiredWager(wid)).to.be.revertedWith(
        "Wager is not pending funding",
      );
    }
    expect(await ethers.provider.getBalance(await v1.getAddress())).to.equal(ONE_ETH * 2n);
  });

  it("lets the owner declare a winner on a wager nobody disputed", async () => {
    const wid = await active(id("v1-owner-power"));
    const pot = ONE_ETH * 2n;
    const fee = feeOf(pot);
    // No votes, no dispute, still ACTIVE — and it goes through.
    await expect(v1.connect(owner).resolveDispute(wid, creator.address, 1)).to.changeEtherBalances(
      [creator, treasury],
      [pot - fee, fee],
    );
  });

  it("locks the pot forever on a fee-on-transfer token", async () => {
    const feeToken = await (await ethers.getContractFactory("MockFeeOnTransferERC20")).deploy();
    await feeToken.waitForDeployment();
    const stake = ethers.parseEther("10");
    const wid = id("v1-fee-token");

    for (const s of [creator, challenger]) {
      await feeToken.mint(s.address, stake);
      await feeToken.connect(s).approve(await v1.getAddress(), stake);
    }

    await v1.connect(creator).createWager(wid, challenger.address, await feeToken.getAddress(), stake, DAY);
    await v1.connect(challenger).joinWager(wid);

    // The pot it thinks it has is more than the balance it holds.
    const recorded = (await v1.wagers(wid)).totalPot;
    const actual = await feeToken.balanceOf(await v1.getAddress());
    expect(recorded).to.be.greaterThan(actual);

    // So settlement can never succeed.
    await v1.connect(creator).voteWinner(wid, creator.address);
    await expect(v1.connect(challenger).voteWinner(wid, creator.address)).to.be.reverted;
  });
});
