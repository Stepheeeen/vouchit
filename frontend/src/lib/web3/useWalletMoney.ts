"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { ACTIVE_CHAIN } from "./config";
import { isNativeToken, type StakeToken } from "./tokens";
import { erc20Abi } from "./escrowAbi";

/**
 * What the connected wallet actually holds, for one stake token.
 *
 * The balance was only ever read on the wallet page, so the place it mattered
 * most — the stake field on Create Vouch — had no idea whether the amount
 * being typed was affordable. People found out when the wallet rejected the
 * transaction, after committing to the whole flow.
 */
export function useTokenBalance(token: StakeToken | undefined) {
  const { address } = useAccount();
  const native = token ? isNativeToken(token.address) : false;

  const nativeBalance = useBalance({
    address,
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: !!address && !!token && native },
  });

  const erc20Balance = useReadContract({
    abi: erc20Abi,
    address: token?.address,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: !!address && !!token && !native },
  });

  const value = native ? nativeBalance.data?.value : (erc20Balance.data as bigint | undefined);

  return {
    value: value ?? null,
    isLoading: native ? nativeBalance.isLoading : erc20Balance.isLoading,
    refetch: native ? nativeBalance.refetch : erc20Balance.refetch,
  };
}

/**
 * Native-coin balance, which is what pays for gas.
 *
 * Worth its own hook because it is a distinct failure: someone can hold
 * plenty of USDC and still be unable to place a wager, because every
 * transaction on Base is paid for in ETH. Without this the app let them try
 * and let the wallet deliver the bad news.
 */
export function useGasBalance() {
  const { address } = useAccount();
  const { data, isLoading, refetch } = useBalance({
    address,
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: !!address },
  });
  return { value: data?.value ?? null, isLoading, refetch };
}

/**
 * Rough fiat value of a token amount.
 *
 * "0.0002 ETH" tells almost nobody whether they are betting lunch money or a
 * month's rent, and every stake in this app was shown that way only. The
 * figure is indicative — it is a spot price fetched in the browser, not a
 * quote, and nothing is settled against it.
 */
const PRICE_TTL_MS = 60_000;
const priceCache = new Map<string, { usd: number; at: number }>();

/**
 * Where to ask what a token is worth.
 *
 * Coinbase used to be the only source. A tester reported being unable to
 * reach Coinbase at all without a VPN — they restrict access in several
 * countries, Nigeria among them, which is the market this is built for. A
 * single-source lookup meant every dollar figure silently vanished for those
 * users. CoinGecko leads because it is reachable where Coinbase is not and
 * needs no key; Coinbase stays as a second opinion rather than the authority.
 *
 * Prices here are indicative only — nothing settles against them — so a total
 * failure degrades to showing no approximation rather than blocking anything.
 */
const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  cbBTC: "coinbase-wrapped-btc",
  BTC: "bitcoin",
};

async function fetchUsdPrice(symbol: string): Promise<number | null> {
  const id = COINGECKO_IDS[symbol];
  if (id) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (res.ok) {
        const body = await res.json();
        const value = Number(body?.[id]?.usd);
        if (Number.isFinite(value) && value > 0) return value;
      }
    } catch {
      // Unreachable or slow — try the next source.
    }
  }

  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`, {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const body = await res.json();
      const value = Number(body?.data?.amount);
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch {
    // Both sources unreachable. The UI simply omits the approximation.
  }

  return null;
}

export function useUsdPrice(symbol: string | undefined) {
  const [usd, setUsd] = useState<number | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    // A dollar-pegged stablecoin needs no lookup, and pretending otherwise
    // would put a needless network call in front of the common case.
    if (symbol === "USDC" || symbol === "USDT" || symbol === "DAI") {
      setUsd(1);
      return;
    }

    const cached = priceCache.get(symbol);
    if (cached && Date.now() - cached.at < PRICE_TTL_MS) {
      setUsd(cached.usd);
      return;
    }

    (async () => {
      const price = await fetchUsdPrice(symbol);
      if (price === null || cancelled) return;
      priceCache.set(symbol, { usd: price, at: Date.now() });
      setUsd(price);
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return usd;
}

/** Format a base-unit amount as an approximate USD string, or null. */
export function toUsd(
  amount: bigint | null | undefined,
  decimals: number,
  usdPrice: number | null,
): string | null {
  if (amount === null || amount === undefined || usdPrice === null) return null;
  const value = Number(formatUnits(amount, decimals)) * usdPrice;
  if (!Number.isFinite(value)) return null;
  if (value > 0 && value < 0.01) return "<$0.01";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
