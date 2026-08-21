/**
 * Supported stake currencies.
 *
 * Vouchit is crypto-denominated: a wager's stake IS an amount of one of these
 * tokens. There is no fiat conversion anywhere in the wager path, so no price
 * oracle is required to verify that an on-chain stake matches what the user
 * agreed to.
 */
import { base, baseSepolia } from "wagmi/chains";

export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface StakeToken {
  /** Contract address, or the zero address for the chain's native coin. */
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  /** Smallest stake we allow, in base units. Keeps dust wagers out. */
  minStake: bigint;
  /** Step used by the amount input. */
  stakeStep: string;
}

export const TOKENS_BY_CHAIN: Record<number, StakeToken[]> = {
  [base.id]: [
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      minStake: 1_000_000n, // 1 USDC
      stakeStep: "1",
    },
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      minStake: 200_000_000_000_000n, // 0.0002 ETH
      stakeStep: "0.001",
    },
  ],
  [baseSepolia.id]: [
    {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      symbol: "USDC",
      name: "USD Coin (testnet)",
      decimals: 6,
      minStake: 1_000_000n,
      stakeStep: "1",
    },
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      name: "Ether (testnet)",
      decimals: 18,
      minStake: 200_000_000_000_000n,
      stakeStep: "0.001",
    },
  ],
};

export const isNativeToken = (address: string) =>
  address.toLowerCase() === NATIVE_TOKEN_ADDRESS;

export function getTokens(chainId: number | undefined): StakeToken[] {
  if (!chainId) return [];
  return TOKENS_BY_CHAIN[chainId] ?? [];
}

export function findToken(chainId: number | undefined, address: string): StakeToken | undefined {
  return getTokens(chainId).find((t) => t.address.toLowerCase() === address.toLowerCase());
}
