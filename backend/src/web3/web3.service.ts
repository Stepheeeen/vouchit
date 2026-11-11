import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verifyMessage, JsonRpcProvider, Contract, Wallet, isAddress } from 'ethers';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { VOUCHIT_ESCROW_ABI, OnChainWagerStatus } from './escrow.abi';
import { getChainId } from './tokens';

@Injectable()
export class Web3Service {
  constructor(private prisma: PrismaService) {}

  /**
   * Verify an EVM signature for a given message
   */
  /**
   * Verify an EVM signature, for a key-pair wallet OR a smart contract wallet.
   *
   * This used to be `ethers.verifyMessage()` alone, which performs ECDSA
   * public-key recovery. That cannot work for the wallet this app actually
   * ships: the connector is configured `smartWalletOnly`, so every passkey
   * user gets a Coinbase Smart Wallet — an ERC-4337 contract account. Those
   * do not produce ECDSA signatures; they produce ERC-1271 signatures, which
   * are validated by CALLING the wallet contract, not by recovering a key
   * from them. Recovery either threw or returned an unrelated address, so
   * linking a passkey wallet failed with "Invalid signature" every time.
   *
   * There is a second trap behind that one. A Coinbase Smart Wallet is
   * *counterfactual* until its first transaction: the address is known and
   * fundable, but no contract exists at it yet, so there is nothing to call
   * `isValidSignature` on. ERC-6492 covers that by wrapping the signature
   * with the deployment data needed to simulate the account into existence.
   * A brand-new user — exactly the person signing up — is always in this
   * state, so handling ERC-1271 without ERC-6492 would still fail for most
   * of them.
   *
   * viem's `verifyMessage` handles all three cases (ECDSA, ERC-1271,
   * ERC-6492) through the universal signature validator, so the check is
   * delegated to it. The ECDSA path is tried locally first to avoid an RPC
   * round-trip for browser-extension wallets.
   */
  async verifySignature(address: string, signature: string, message: string): Promise<boolean> {
    // Fast path: a plain key-pair wallet needs no network call.
    try {
      if (verifyMessage(message, signature).toLowerCase() === address.toLowerCase()) {
        return true;
      }
    } catch {
      // Not an ECDSA signature — fall through to the on-chain check.
    }

    const rpcUrl = process.env.WEB3_RPC_URL;
    // Fail closed rather than reaching for viem's bundled public endpoint.
    // Contract verification is a real RPC call, and an unconfigured server
    // silently borrowing someone else's node is both unreliable and a
    // surprise dependency — the same server cannot read the escrow without
    // this variable anyway.
    if (!rpcUrl) {
      console.error(
        '[Web3Service] Cannot verify a contract-wallet signature: WEB3_RPC_URL is not set.',
      );
      return false;
    }

    const chain = getChainId() === base.id ? base : baseSepolia;
    try {
      const client = createPublicClient({ chain, transport: http(rpcUrl) });
      return await client.verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (error) {
      console.error('[Web3Service] Smart-wallet signature verification failed:', error);
      return false;
    }
  }

  /**
   * Link an EVM wallet address to a user account
   */
  async linkWallet(userId: string, address: string, signature: string) {
    if (!address || !signature) {
      throw new BadRequestException('Address and signature are required');
    }

    const expectedMessage = `Sign to verify ownership of wallet ${address} for Vouchit account ${userId}`;
    const isValid = await this.verifySignature(address, signature, expectedMessage);

    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    const normalizedAddress = address.toLowerCase();

    // Check if address is already linked to another account
    const existing = await this.prisma.user.findUnique({
      where: { web3Address: normalizedAddress },
    });
    if (existing && existing.id !== userId) {
      throw new BadRequestException('This wallet address is already linked to another account');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { web3Address: normalizedAddress },
    });

    return { message: 'Wallet linked successfully', user };
  }

  /**
   * Unlink the wallet from this account.
   *
   * Refused while a wager is live, which it was not before. The escrow does
   * not care about this field — it pays the address that staked, and will go
   * on doing so — but every app-side check does: verifyOnChainWager and
   * verifyOnChainJoin compare the escrow entry against `web3Address`, so
   * clearing it mid-wager leaves someone with real money in the contract and
   * no way to register their join, vote or settlement through Vouchit. Their
   * funds are recoverable on-chain, but only by someone who knows to go
   * looking, which is not a position to put a user in.
   */
  async unlinkWallet(userId: string) {
    const live = await this.prisma.wagerParticipant.count({
      where: {
        userId,
        wager: { status: { in: ['PENDING_FUNDING', 'ACTIVE', 'DISPUTED'] } },
      },
    });
    if (live > 0) {
      throw new BadRequestException(
        'You have wagers still open on-chain. Settle or cancel them before unlinking this wallet — payouts go to the wallet that staked.',
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { web3Address: null },
    });
    return { message: 'Wallet unlinked successfully', user };
  }

  /**
   * Read-only provider/contract handle. Returns null when the chain env vars are
   * absent, which is what keeps local/dev environments working without an RPC.
   */
  private getEscrowContract(): Contract | null {
    const contractAddress = process.env.VOUCHIT_ESCROW_CONTRACT_ADDRESS;
    const rpcUrl = process.env.WEB3_RPC_URL;
    if (!contractAddress || !rpcUrl) return null;
    return new Contract(contractAddress, VOUCHIT_ESCROW_ABI, new JsonRpcProvider(rpcUrl));
  }

  /** True when the backend is configured to talk to a real deployed escrow. */
  isChainConfigured(): boolean {
    return this.getEscrowContract() !== null;
  }

  /**
   * Verify that a client-supplied `contractWagerId` corresponds to a real, funded
   * wager on the deployed escrow, created by the address linked to `userId`.
   *
   * Without this the web3 path is free money: `createWager` skips the custodial
   * balance check entirely for `isWeb3`, so an unverified id would mint a fully
   * ACTIVE wager backed by nothing.
   */
  async verifyOnChainWager(
    userId: string,
    contractWagerId: string,
    expectedStake?: bigint,
  ): Promise<{
    creator: string;
    stakeAmount: bigint;
    token: string;
    status: number;
    challenger: string;
    expiresAt: number;
  }> {
    if (!/^0x[0-9a-fA-F]{64}$/.test(contractWagerId ?? '')) {
      throw new BadRequestException('contractWagerId must be a 32-byte hex string');
    }

    const escrow = this.getEscrowContract();
    if (!escrow) {
      throw new BadRequestException(
        'On-chain wagers are unavailable: the escrow contract is not configured on this server.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.web3Address) {
      throw new BadRequestException('Link a web3 wallet before creating an on-chain wager');
    }

    let onChain: any;
    try {
      onChain = await escrow.wagers(contractWagerId);
    } catch (error: any) {
      console.error('[Web3Service] Failed to read wager from chain:', error);
      throw new BadRequestException('Could not reach the escrow contract to verify this wager');
    }

    const creator: string = onChain.creator;
    if (!isAddress(creator) || creator === '0x0000000000000000000000000000000000000000') {
      throw new BadRequestException('No such wager exists on the escrow contract');
    }

    if (creator.toLowerCase() !== user.web3Address.toLowerCase()) {
      throw new BadRequestException('This on-chain wager was created by a different wallet');
    }

    const status = Number(onChain.status);
    if (status !== OnChainWagerStatus.PENDING_FUNDING && status !== OnChainWagerStatus.ACTIVE) {
      throw new BadRequestException('This on-chain wager is already settled or cancelled');
    }

    const stakeAmount: bigint = onChain.stakeAmount;
    if (stakeAmount <= 0n) {
      throw new BadRequestException('This on-chain wager holds no stake');
    }
    if (expectedStake !== undefined && stakeAmount !== expectedStake) {
      throw new BadRequestException('On-chain stake does not match the submitted amount');
    }

    return {
      creator,
      stakeAmount,
      token: onChain.token,
      status,
      challenger: String(onChain.challenger),
      expiresAt: Number(onChain.expiresAt),
    };
  }

  /** Raw read of an escrow entry. Callers decide what the state means. */
  async getOnChainWager(contractWagerId: string) {
    const escrow = this.getEscrowContract();
    if (!escrow) {
      throw new BadRequestException(
        'On-chain wagers are unavailable: the escrow contract is not configured on this server.',
      );
    }
    try {
      const w = await escrow.wagers(contractWagerId);
      return {
        creator: String(w.creator),
        challenger: String(w.challenger),
        token: String(w.token),
        stakeAmount: w.stakeAmount as bigint,
        totalPot: w.totalPot as bigint,
        status: Number(w.status) as OnChainWagerStatus,
        winner: String(w.winner),
        creatorVote: String(w.creatorVote),
        challengerVote: String(w.challengerVote),
        expiresAt: Number(w.expiresAt),
      };
    } catch (error: any) {
      console.error('[Web3Service] Failed to read wager from chain:', error);
      throw new BadRequestException('Could not reach the escrow contract');
    }
  }

  /**
   * Confirm that `userId`'s wallet has escrowed the matching stake and that the
   * escrow entry is now ACTIVE. Called when a challenger registers their join,
   * so the DB only ever records a join the chain already accepted.
   */
  async verifyOnChainJoin(userId: string, contractWagerId: string) {
    const escrow = this.getEscrowContract();
    if (!escrow) {
      throw new BadRequestException(
        'On-chain wagers are unavailable: the escrow contract is not configured on this server.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.web3Address) {
      throw new BadRequestException('Link a web3 wallet before joining an on-chain wager');
    }

    let onChain: any;
    try {
      onChain = await escrow.wagers(contractWagerId);
    } catch (error: any) {
      console.error('[Web3Service] Failed to read wager from chain:', error);
      throw new BadRequestException('Could not reach the escrow contract to verify this join');
    }

    if (Number(onChain.status) !== OnChainWagerStatus.ACTIVE) {
      throw new BadRequestException('This wager has not been funded on-chain yet');
    }
    if (String(onChain.challenger).toLowerCase() !== user.web3Address.toLowerCase()) {
      throw new BadRequestException('A different wallet joined this wager on-chain');
    }

    return {
      challenger: String(onChain.challenger),
      stakeAmount: onChain.stakeAmount as bigint,
      totalPot: onChain.totalPot as bigint,
      token: String(onChain.token),
    };
  }

  /**
   * Trigger on-chain dispute resolution via Admin Relayer
   * If WEB3_RPC_URL or ADMIN_PRIVATE_KEY is missing, logs mock relayer event
   */
  async resolveOnChainDispute(
    wagerId: string,
    contractWagerId: string,
    winnerAddress: string,
    resolutionType: 1 | 2,
  ) {
    const contractAddress = process.env.VOUCHIT_ESCROW_CONTRACT_ADDRESS;
    const rpcUrl = process.env.WEB3_RPC_URL;
    const adminPrivateKey = process.env.ADMIN_RELAYER_PRIVATE_KEY;

    if (!contractAddress || !rpcUrl || !adminPrivateKey) {
      // Mock mode reports success without moving any money. That is fine for local
      // development, but in production it would mark a dispute SETTLED and notify
      // the winner of a payout that never happened — so refuse there.
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException(
          'Cannot resolve on-chain dispute: the relayer is not configured on this server.',
        );
      }
      console.log(`[Web3Service Mock Relayer] On-chain dispute resolved for wager ${wagerId} (Contract ID: ${contractWagerId}): Winner=${winnerAddress}, Type=${resolutionType}`);
      return {
        success: true,
        txHash: `0xmock_tx_${Date.now()}`,
        message: 'On-chain dispute resolved (Mock Relayer Mode)',
      };
    }

    try {
      // ethers is imported statically at the top of this file. A dynamic
      // import here shadowed those bindings for no benefit and threw
      // "A dynamic import callback was invoked without --experimental-vm-modules",
      // which made the relayer path — the only one where we sign on a user's
      // behalf — impossible to exercise in tests.
      const provider = new JsonRpcProvider(rpcUrl);
      const relayerWallet = new Wallet(adminPrivateKey, provider);

      const abi = [
        'function resolveDispute(bytes32 wagerId, address winner, uint8 resolutionType) external',
      ];
      const escrowContract = new Contract(contractAddress, abi, relayerWallet);

      const tx = await escrowContract.resolveDispute(contractWagerId, winnerAddress, resolutionType);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        message: 'On-chain dispute resolved successfully',
      };
    } catch (error: any) {
      console.error('[Web3Service] Failed to resolve on-chain dispute:', error);
      throw new BadRequestException(error.message || 'Failed to trigger on-chain dispute resolution');
    }
  }
}
