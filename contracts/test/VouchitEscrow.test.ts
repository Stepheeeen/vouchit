import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const ONE_ETH = ethers.parseEther("1");
const DAY = 24 * 60 * 60;
const FEE_BPS = 250n;
const BPS = 10_000n;

const id = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const feeOf = (pot: bigint) => (pot * FEE_BPS) / BPS;

describe("VouchitEscrow", () => {
  let escrow: any;
  let token: any;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let creator: HardhatEthersSigner;
  let challenger: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, treasury, creator, challenger, outsider] = await ethers.getSigners();
    escrow = await (await ethers.getContractFactory("VouchitEscrow")).deploy(treasury.address);
    await escrow.waitForDeployment();
    token = await (await ethers.getContractFactory("MockERC20")).deploy();
    await token.waitForDeployment();
  });

  const createNative = async (wagerId: string, target = ethers.ZeroAddress) =>
    escrow.connect(creator).createWager(wagerId, target, ethers.ZeroAddress, ONE_ETH, DAY, { value: ONE_ETH });

  describe("deployment", () => {
    it("sets owner and treasury", async () => {
      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.treasury()).to.equal(treasury.address);
    });

    it("rejects a zero treasury", async () => {
      const factory = await ethers.getContractFactory("VouchitEscrow");
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWith("Invalid treasury address");
    });
  });

  describe("createWager", () => {
    it("escrows the exact native stake", async () => {
      const wid = id("w1");
      await expect(createNative(wid)).to.emit(escrow, "WagerCreated");
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(ONE_ETH);
      const w = await escrow.wagers(wid);
      expect(w.creator).to.equal(creator.address);
      expect(w.totalPot).to.equal(ONE_ETH);
      expect(w.status).to.equal(0); // PENDING_FUNDING
    });

    it("rejects a mismatched msg.value", async () => {
      await expect(
        escrow.connect(creator).createWager(id("w2"), ethers.ZeroAddress, ethers.ZeroAddress, ONE_ETH, DAY, {
          value: ethers.parseEther("0.5"),
        }),
      ).to.be.revertedWith("Must send exact native ETH stake");
    });

    it("rejects a duplicate wager id", async () => {
      const wid = id("dup");
      await createNative(wid);
      await expect(createNative(wid)).to.be.revertedWith("Wager ID already exists");
    });

    it("rejects wagering against yourself", async () => {
      await expect(
        escrow.connect(creator).createWager(id("self"), creator.address, ethers.ZeroAddress, ONE_ETH, DAY, {
          value: ONE_ETH,
        }),
      ).to.be.revertedWith("Cannot wager against yourself");
    });

    it("rejects a zero stake", async () => {
      await expect(
        escrow.connect(creator).createWager(id("zero"), ethers.ZeroAddress, ethers.ZeroAddress, 0, DAY, { value: 0 }),
      ).to.be.revertedWith("Stake amount must be > 0");
    });

    it("escrows an ERC20 stake", async () => {
      const wid = id("erc20");
      const stake = 1_000_000n;
      await token.mint(creator.address, stake);
      await token.connect(creator).approve(await escrow.getAddress(), stake);
      await escrow.connect(creator).createWager(wid, ethers.ZeroAddress, await token.getAddress(), stake, DAY);
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(stake);
    });

    it("rejects ETH sent alongside an ERC20 wager", async () => {
      await expect(
        escrow
          .connect(creator)
          .createWager(id("mix"), ethers.ZeroAddress, await token.getAddress(), 100n, DAY, { value: 1n }),
      ).to.be.revertedWith("Do not send ETH for ERC20 wager");
    });
  });

  describe("joinWager", () => {
    it("funds an open wager and flips it ACTIVE", async () => {
      const wid = id("join");
      await createNative(wid);
      await expect(escrow.connect(challenger).joinWager(wid, { value: ONE_ETH })).to.emit(escrow, "WagerJoined");
      const w = await escrow.wagers(wid);
      expect(w.status).to.equal(1); // ACTIVE
      expect(w.challenger).to.equal(challenger.address);
      expect(w.totalPot).to.equal(ONE_ETH * 2n);
    });

    it("blocks anyone but the designated challenger", async () => {
      const wid = id("targeted");
      await createNative(wid, challenger.address);
      await expect(escrow.connect(outsider).joinWager(wid, { value: ONE_ETH })).to.be.revertedWith(
        "You are not the designated challenger",
      );
    });

    it("blocks the creator from joining their own wager", async () => {
      const wid = id("selfjoin");
      await createNative(wid);
      await expect(escrow.connect(creator).joinWager(wid, { value: ONE_ETH })).to.be.revertedWith(
        "Creator cannot join their own wager",
      );
    });

    it("blocks joining after expiry", async () => {
      const wid = id("expired");
      await createNative(wid);
      await time.increase(DAY + 1);
      await expect(escrow.connect(challenger).joinWager(wid, { value: ONE_ETH })).to.be.revertedWith(
        "Wager has expired",
      );
    });

    it("blocks double-joining", async () => {
      const wid = id("double");
      await createNative(wid);
      await escrow.connect(challenger).joinWager(wid, { value: ONE_ETH });
      await expect(escrow.connect(outsider).joinWager(wid, { value: ONE_ETH })).to.be.revertedWith(
        "Wager is not pending funding",
      );
    });
  });

  describe("voteWinner / settlement", () => {
    const wid = id("settle");

    beforeEach(async () => {
      await createNative(wid);
      await escrow.connect(challenger).joinWager(wid, { value: ONE_ETH });
    });

    it("pays the winner and the treasury on mutual agreement", async () => {
      const pot = ONE_ETH * 2n;
      const fee = feeOf(pot);
      const payout = pot - fee;

      await escrow.connect(creator).voteWinner(wid, creator.address);
      await expect(escrow.connect(challenger).voteWinner(wid, creator.address)).to.changeEtherBalances(
        [creator, treasury],
        [payout, fee],
      );

      const w = await escrow.wagers(wid);
      expect(w.status).to.equal(2); // SETTLED
      expect(w.winner).to.equal(creator.address);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("does not settle while votes disagree", async () => {
      await escrow.connect(creator).voteWinner(wid, creator.address);
      await escrow.connect(challenger).voteWinner(wid, challenger.address);
      expect((await escrow.wagers(wid)).status).to.equal(1); // still ACTIVE
    });

    it("rejects votes from non-participants", async () => {
      await expect(escrow.connect(outsider).voteWinner(wid, creator.address)).to.be.revertedWith(
        "Only participants can vote",
      );
    });

    it("rejects a winner who is not a participant", async () => {
      await expect(escrow.connect(creator).voteWinner(wid, outsider.address)).to.be.revertedWith(
        "Winner must be a participant",
      );
    });

    it("leaves no dust in the contract", async () => {
      await escrow.connect(creator).voteWinner(wid, challenger.address);
      await escrow.connect(challenger).voteWinner(wid, challenger.address);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });
  });

  describe("disputes", () => {
    const wid = id("dispute");

    beforeEach(async () => {
      await createNative(wid);
      await escrow.connect(challenger).joinWager(wid, { value: ONE_ETH });
    });

    it("lets a participant open a dispute", async () => {
      await expect(escrow.connect(creator).openDispute(wid)).to.emit(escrow, "DisputeOpened");
      expect((await escrow.wagers(wid)).status).to.equal(3); // DISPUTED
    });

    it("blocks outsiders from opening a dispute", async () => {
      await expect(escrow.connect(outsider).openDispute(wid)).to.be.revertedWith("Only participants can dispute");
    });

    it("pays out the winner on owner resolution type 1", async () => {
      const pot = ONE_ETH * 2n;
      const fee = feeOf(pot);
      await escrow.connect(creator).openDispute(wid);
      await expect(escrow.connect(owner).resolveDispute(wid, challenger.address, 1)).to.changeEtherBalances(
        [challenger, treasury],
        [pot - fee, fee],
      );
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("refunds both sides on owner resolution type 2", async () => {
      await escrow.connect(creator).openDispute(wid);
      await expect(escrow.connect(owner).resolveDispute(wid, ethers.ZeroAddress, 2)).to.changeEtherBalances(
        [creator, challenger],
        [ONE_ETH, ONE_ETH],
      );
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("blocks non-owners from resolving", async () => {
      await escrow.connect(creator).openDispute(wid);
      await expect(escrow.connect(creator).resolveDispute(wid, creator.address, 1)).to.be.revertedWith(
        "VouchitEscrow: caller is not the owner",
      );
    });

    it("rejects an invalid resolution type", async () => {
      await escrow.connect(creator).openDispute(wid);
      await expect(escrow.connect(owner).resolveDispute(wid, creator.address, 3)).to.be.revertedWith(
        "Invalid resolution type",
      );
    });

    it("cannot resolve the same dispute twice", async () => {
      await escrow.connect(creator).openDispute(wid);
      await escrow.connect(owner).resolveDispute(wid, creator.address, 1);
      await expect(escrow.connect(owner).resolveDispute(wid, creator.address, 1)).to.be.revertedWith(
        "Wager not active or disputed",
      );
    });
  });

  describe("cancelExpiredWager", () => {
    it("refunds the creator of an unjoined expired wager", async () => {
      const wid = id("cancel");
      await createNative(wid);
      await time.increase(DAY + 1);
      await expect(escrow.cancelExpiredWager(wid)).to.changeEtherBalances([creator], [ONE_ETH]);
      expect((await escrow.wagers(wid)).status).to.equal(4); // CANCELLED
    });

    it("blocks cancelling before expiry", async () => {
      const wid = id("early");
      await createNative(wid);
      await expect(escrow.cancelExpiredWager(wid)).to.be.revertedWith("Wager has not expired yet");
    });

    it("cannot be cancelled twice", async () => {
      const wid = id("twice");
      await createNative(wid);
      await time.increase(DAY + 1);
      await escrow.cancelExpiredWager(wid);
      await expect(escrow.cancelExpiredWager(wid)).to.be.revertedWith("Wager is not pending funding");
    });
  });

  describe("admin", () => {
    it("lets the owner rotate treasury and owner", async () => {
      await escrow.connect(owner).setTreasury(outsider.address);
      expect(await escrow.treasury()).to.equal(outsider.address);
      await escrow.connect(owner).setOwner(outsider.address);
      expect(await escrow.owner()).to.equal(outsider.address);
    });

    it("blocks non-owners from admin functions", async () => {
      await expect(escrow.connect(outsider).setTreasury(outsider.address)).to.be.revertedWith(
        "VouchitEscrow: caller is not the owner",
      );
    });
  });
});
