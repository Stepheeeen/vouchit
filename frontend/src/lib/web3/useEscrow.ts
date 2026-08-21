"use client";

import { useCallback } from "react";
import { useAccount, useConfig } from "wagmi";
import { readContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseUnits, zeroAddress, type Hex } from "viem";
import { escrowAbi, erc20Abi } from "./escrowAbi";
import { ESCROW_ADDRESS, isEscrowConfigured } from "./config";
import { isNativeToken, type StakeToken } from "./tokens";

/** Cryptographically random 32-byte wager id, generated client-side. */
function newWagerId(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

export interface CreateWagerArgs {
  token: StakeToken;
  /** Human-entered stake, e.g. "25" for 25 USDC. */
  stake: string;
  expiryDays: number;
  /** Optional targeted opponent; open to anyone when omitted. */
  challenger?: `0x${string}`;
}

export function useEscrow() {
  const config = useConfig();
  const { address } = useAccount();

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
    async ({ token, stake, expiryDays, challenger }: CreateWagerArgs) => {
      const owner = requireReady();
      const stakeAmount = parseUnits(stake, token.decimals);

      if (stakeAmount < token.minStake) {
        throw new Error(`Stake is below the ${token.symbol} minimum.`);
      }

      const wagerId = newWagerId();
      const durationSeconds = BigInt(expiryDays * 24 * 60 * 60);
      const native = isNativeToken(token.address);

      if (!native) {
        const allowance = await readContract(config, {
          abi: erc20Abi,
          address: token.address,
          functionName: "allowance",
          args: [owner, ESCROW_ADDRESS],
        });
        if (allowance < stakeAmount) {
          const approvalHash = await writeContract(config, {
            abi: erc20Abi,
            address: token.address,
            functionName: "approve",
            args: [ESCROW_ADDRESS, stakeAmount],
          });
          await waitForTransactionReceipt(config, { hash: approvalHash });
        }
      }

      const hash = await writeContract(config, {
        abi: escrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "createWager",
        args: [wagerId, challenger ?? zeroAddress, token.address, stakeAmount, durationSeconds],
        value: native ? stakeAmount : 0n,
      });

      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") {
        throw new Error("The escrow transaction failed on-chain.");
      }

      return { wagerId, txHash: hash, stakeAmount };
    },
    [config, requireReady],
  );

  /** Match the creator's stake and activate the wager. */
  const joinWager = useCallback(
    async (wagerId: Hex, token: StakeToken) => {
      const owner = requireReady();

      const onChain = await readContract(config, {
        abi: escrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "wagers",
        args: [wagerId],
      });
      const stakeAmount = onChain[4];

      if (!isNativeToken(token.address)) {
        const allowance = await readContract(config, {
          abi: erc20Abi,
          address: token.address,
          functionName: "allowance",
          args: [owner, ESCROW_ADDRESS],
        });
        if (allowance < stakeAmount) {
          const approvalHash = await writeContract(config, {
            abi: erc20Abi,
            address: token.address,
            functionName: "approve",
            args: [ESCROW_ADDRESS, stakeAmount],
          });
          await waitForTransactionReceipt(config, { hash: approvalHash });
        }
      }

      const hash = await writeContract(config, {
        abi: escrowAbi,
        address: ESCROW_ADDRESS,
        functionName: "joinWager",
        args: [wagerId],
        value: isNativeToken(token.address) ? stakeAmount : 0n,
      });

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
    [config, requireReady],
  );

  return { createWager, joinWager, voteWinner, openDispute, isReady: isEscrowConfigured() && !!address };
}
