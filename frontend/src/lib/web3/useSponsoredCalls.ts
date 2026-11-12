"use client";

import { useCallback, useMemo } from "react";
import { useAccount, useConfig, useCapabilities } from "wagmi";
import { sendCalls, waitForCallsStatus } from "wagmi/actions";
import type { Hex } from "viem";
import { ACTIVE_CHAIN } from "./config";
import { decideSponsorship } from "./sponsorship";

/**
 * Paying the network fee for the user, and collapsing their transactions
 * into one prompt.
 *
 * Both come from the same capability. Every passkey user has a Coinbase Smart
 * Wallet, which is an ERC-4337 smart account, and smart accounts speak
 * EIP-5792 (`wallet_sendCalls`). That allows two things an ordinary key-pair
 * wallet cannot do:
 *
 *   1. Attach a paymaster, which settles the gas so the user needs no ETH at
 *      all. This removes the worst dead end in the product — holding USDC and
 *      being unable to stake it, because a Base transaction is paid for in
 *      ETH and nothing in the UI ever said so.
 *   2. Send several calls as ONE atomic operation, so approving the token and
 *      locking the stake become a single prompt that either fully happens or
 *      fully does not. Done sequentially, a failure between the two leaves
 *      someone having paid for an approval that led nowhere.
 *
 * None of this reaches a browser-extension wallet: those are key-pair
 * accounts, they pay their own gas, and they keep the existing sequential
 * path unchanged. `isSponsored` is therefore derived from what the connected
 * wallet actually reports, not from configuration — telling someone their gas
 * is covered and then having their wallet reject the call is worse than never
 * offering.
 */

const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL;

export interface Call {
  to: Hex;
  data: Hex;
  value?: bigint;
}

export function useSponsoredCalls() {
  const config = useConfig();
  const { address } = useAccount();
  const { data: capabilities } = useCapabilities({
    account: address,
    query: { enabled: !!address },
  });

  const chainCapabilities = useMemo(() => {
    if (!capabilities) return undefined;
    return (capabilities as Record<number, any>)[ACTIVE_CHAIN.id];
  }, [capabilities]);

  // Shared with sponsorship.test.ts, so the rule that decides whether we
  // promise free gas is actually covered rather than mirrored.
  const { isSponsored, canBatch } = useMemo(
    () => decideSponsorship(PAYMASTER_URL, chainCapabilities),
    [chainCapabilities],
  );

  /**
   * Run a batch and wait for it to be included.
   *
   * The identifier returned by `sendCalls` is a bundle id, not a transaction
   * hash: a user operation reaches the chain through a bundler and may share
   * a transaction with others, so the receipt is what resolves it to
   * something a block explorer will show.
   */
  const sendBatch = useCallback(
    async (calls: Call[], onUnsponsored?: () => void) => {
      /**
       * Try sponsored, fall back to the user paying.
       *
       * The paymaster is a Coinbase endpoint, and a tester reported being
       * unable to reach Coinbase at all without a VPN. Before this, an
       * unreachable paymaster did not merely cost someone their free gas —
       * `sendCalls` rejected and the whole wager failed, with no hint that
       * the cause was a gas service rather than their stake or their wallet.
       * Paying your own fee is a worse outcome than not paying it; being
       * unable to place a wager is a far worse one than either.
       */
      let id: string;
      if (isSponsored && PAYMASTER_URL) {
        try {
          ({ id } = await sendCalls(config, {
            calls,
            capabilities: { paymasterService: { url: PAYMASTER_URL } },
          }));
        } catch (err: any) {
          // A refusal by the user is a decision, not a fault: do not quietly
          // re-prompt them for the same thing without sponsorship.
          if (/reject|denied|cancel/i.test(String(err?.message ?? ""))) throw err;
          console.warn("[Vouchit] Gas sponsorship unavailable, continuing unsponsored:", err);
          onUnsponsored?.();
          ({ id } = await sendCalls(config, { calls }));
        }
      } else {
        ({ id } = await sendCalls(config, { calls }));
      }

      const status = await waitForCallsStatus(config, { id, timeout: 120_000 });
      if (status.status !== "success") {
        throw new Error("The transaction did not complete. Nothing has been staked.");
      }

      // The escrow call is last in the batch, so its receipt is the one worth
      // linking to.
      const receipts = status.receipts ?? [];
      return {
        id,
        txHash: (receipts[receipts.length - 1]?.transactionHash ?? null) as Hex | null,
      };
    },
    [config, isSponsored],
  );

  return { isSponsored, canBatch, sendBatch, paymasterConfigured: !!PAYMASTER_URL };
}
