"use client";

import { useCallback } from "react";
import { useAccount, useConfig } from "wagmi";
import { readContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseUnits, zeroAddress, encodeFunctionData, type Hex } from "viem";
import { useSponsoredCalls, type Call } from "./useSponsoredCalls";
import { escrowAbi, erc20Abi } from "./escrowAbi";
import { ESCROW_ADDRESS, isEscrowConfigured } from "./config";
import { isNativeToken, type StakeToken } from "./tokens";

/** Cryptographically random 32-byte wager id, generated client-side. */
function newWagerId(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

/**
 * How much ERC20 spend to approve at once.
 *
 * The approval was for exactly the stake, so the allowance was spent down to
 * zero by every wager and the next one needed another approval — making a
 * USDC wager two signatures and two confirmations, every single time. Granting
 * a batch means the second and subsequent wagers are one signature.
 *
 * Deliberately NOT an unlimited approval. The escrow has not been audited by a
 * third party, and an infinite allowance would let a bug in it reach every
 * token the user holds, forever. A bounded multiple keeps the blast radius to
 * roughly what someone would wager in a sitting while still removing the
 * repeat prompt.
 */
const APPROVAL_BATCH_MULTIPLE = 10n;

/** Steps the UI can report while a multi-transaction flow runs. */
export type EscrowProgress =
  | { step: "approving"; hash?: Hex }
  | { step: "awaiting-approval"; hash: Hex }
  | { step: "signing"; hash?: Hex; sponsored?: boolean; batched?: boolean }
  | { step: "confirming"; hash: Hex };

export interface CreateWagerArgs {
  token: StakeToken;
  /** Human-entered stake, e.g. "25" for 25 USDC. */
  stake: string;
  expiryDays: number;
  /** Optional targeted opponent; open to anyone when omitted. */
  challenger?: `0x${string}`;
  /** Called as the flow moves between transactions. */
  onProgress?: (p: EscrowProgress) => void;
}

/**
 * Make sure the escrow may move `needed` of this token, approving a batch if
 * not. Returns without a transaction when the existing allowance covers it,
 * which is the point: a repeat wager costs one signature, not two.
 */
async function ensureAllowance(
  config: ReturnType<typeof useConfig>,
  owner: `0x${string}`,
  token: StakeToken,
  needed: bigint,
  onProgress?: (p: EscrowProgress) => void,
) {
  const allowance = await readContract(config, {
    abi: erc20Abi,
    address: token.address,
    functionName: "allowance",
    args: [owner, ESCROW_ADDRESS],
  });
  if (allowance >= needed) return;

  const batch = needed * APPROVAL_BATCH_MULTIPLE;
  onProgress?.({ step: "approving" });
  const approvalHash = await writeContract(config, {
    abi: erc20Abi,
    address: token.address,
    functionName: "approve",
    args: [ESCROW_ADDRESS, batch],
  });
  onProgress?.({ step: "awaiting-approval", hash: approvalHash });
  const receipt = await waitForTransactionReceipt(config, { hash: approvalHash });
  if (receipt.status !== "success") {
    throw new Error(`Approving ${token.symbol} failed. Nothing has been staked.`);
  }
}

export function useEscrow() {
  const config = useConfig();
  const { address } = useAccount();
  const { isSponsored, canBatch, sendBatch } = useSponsoredCalls();

  const requireReady = useCallback(() => {
    if (!isEscrowConfigured()) {
      throw new Error("On-chain wagers are unavailable: escrow address is not configured.");
    }
    if (!address) {
      throw new Error("Connect your wallet first.");
    }
    return address;
  }, [address]);

  /**
   * Escrow the creator's stake on-chain and return the id to register with the API.
   * The id is only handed to the backend after the transaction is mined, so the
   * backend's verifyOnChainWager always finds a real, funded wager.
   */
  const createWager = useCallback(
    async ({ token, stake, expiryDays, challenger, onProgress }: CreateWagerArgs) => {
      const owner = requireReady();
      const stakeAmount = parseUnits(stake, token.decimals);

      if (stakeAmount < token.minStake) {
        throw new Error(`Stake is below the ${token.symbol} minimum.`);
      }

      const wagerId = newWagerId();
      const durationSeconds = BigInt(expiryDays * 24 * 60 * 60);
      const native = isNativeToken(token.address);

      const escrowCall: Call = {
        to: ESCROW_ADDRESS,
        data: encodeFunctionData({
          abi: escrowAbi,
          functionName: "createWager",
          args: [wagerId, challenger ?? zeroAddress, token.address, stakeAmount, durationSeconds],
        }),
        value: native ? stakeAmount : 0n,
      };

      // One prompt, and no ETH needed, when the wallet is a smart account.
      // The approval rides along in the same atomic operation instead of
      // being a separate transaction the user pays for and waits on.
      if (canBatch) {
        const calls: Call[] = [];
        if (!native) {
          const allowance = await readContract(config, {
            abi: erc20Abi,
            address: token.address,
            functionName: "allowance",
            args: [owner, ESCROW_ADDRESS],
          });
          if (allowance < stakeAmount) {
            calls.push({
              to: token.address,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [ESCROW_ADDRESS, stakeAmount * APPROVAL_BATCH_MULTIPLE],
              }),
            });
          }
        }
        calls.push(escrowCall);

        onProgress?.({ step: "signing", sponsored: isSponsored, batched: calls.length > 1 });
        const { txHash } = await sendBatch(calls);
              return { wagerId, txHash: txHash ?? ("0x" as Hex), stakeAmount };
      }

      if (!native) {
        await ensureAllowance(config, owner, token, stakeAmount, onProgress);
      }

      onProgress?.({ step: "signing" });
      const hash = await writeContract(config, {
        abi: escrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "createWager",
        args: [wagerId, challenger ?? zeroAddress, token.address, stakeAmount, durationSeconds],
        value: native ? stakeAmount : 0n,
      });

      onProgress?.({ step: "confirming", hash });
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") {
        throw new Error("The escrow transaction failed on-chain.");
      }

      return { wagerId, txHash: hash, stakeAmount };
    },
    [config, requireReady, canBatch, isSponsored, sendBatch],
  );

  /** Match the creator's stake and activate the wager. */
  const joinWager = useCallback(
    async (wagerId: Hex, token: StakeToken, onProgress?: (p: EscrowProgress) => void) => {
      const owner = requireReady();

      const onChain = await readContract(config, {
        abi: escrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "wagers",
        args: [wagerId],
      });
      const stakeAmount = onChain[4];

      const native = isNativeToken(token.address);
      const joinCall: Call = {
        to: ESCROW_ADDRESS,
        data: encodeFunctionData({ abi: escrowAbi, functionName: "joinWager", args: [wagerId] }),
        value: native ? stakeAmount : 0n,
      };

      // Joining deserves this more than creating does: the person accepting a
      // wager is often brand new, arriving from a shared link, and asking
      // them to acquire ETH for gas before they can take a bet is where they
      // leave.
      if (canBatch) {
        const calls: Call[] = [];
        if (!native) {
          const allowance = await readContract(config, {
            abi: erc20Abi,
            address: token.address,
            functionName: "allowance",
            args: [owner, ESCROW_ADDRESS],
          });
          if (allowance < stakeAmount) {
            calls.push({
              to: token.address,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [ESCROW_ADDRESS, stakeAmount * APPROVAL_BATCH_MULTIPLE],
              }),
            });
          }
        }
        calls.push(joinCall);

        onProgress?.({ step: "signing", sponsored: isSponsored, batched: calls.length > 1 });
        const { txHash } = await sendBatch(calls);
        return { txHash: txHash ?? ("0x" as Hex), stakeAmount };
      }

      if (!native) {
        await ensureAllowance(config, owner, token, stakeAmount, onProgress);
      }

      onProgress?.({ step: "signing" });
      const hash = await writeContract(config, {
        abi: escrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "joinWager",
        args: [wagerId],
        value: native ? stakeAmount : 0n,
      });

      onProgress?.({ step: "confirming", hash });
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") {
        throw new Error("The join transaction failed on-chain.");
      }
      return { txHash: hash, stakeAmount };
    },
    [config, requireReady],
  );

  /** Vote for a winner; the contract settles automatically once both sides agree. */
  const voteWinner = useCallback(
    async (wagerId: Hex, votedWinner: `0x${string}`) => {
      requireReady();
      const hash = await writeContract(config, {
        abi: escrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "voteWinner",
        args: [wagerId, votedWinner],
      });
      await waitForTransactionReceipt(config, { hash });
      return { txHash: hash };
    },
    [config, requireReady],
  );

  /** Flag the wager for admin arbitration. */
  const openDispute = useCallback(
    async (wagerId: Hex) => {
      requireReady();
      const hash = await writeContract(config, {
        abi: escrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "openDispute",
        args: [wagerId],
      });
      await waitForTransactionReceipt(config, { hash });
      return { txHash: hash };
    },
    [config, requireReady, canBatch, isSponsored, sendBatch],
  );

  return {
    createWager,
    joinWager,
    voteWinner,
    openDispute,
    isReady: isEscrowConfigured() && !!address,
    /** True when this wallet's network fee will actually be covered. */
    isSponsored,
    /** True when approval and stake can go in a single prompt. */
    canBatch,
  };
}
