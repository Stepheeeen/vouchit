/**
 * Supported stake currencies.
 *
 * Vouchit is crypto-denominated: a wager's stake IS an amount of one of these
 * tokens. There is no fiat conversion anywhere in the wager path, so no price
 * oracle is required to verify that an on-chain stake matches what the user
 * agreed to.
 *
 * An ALLOWLIST on purpose. Not holding user funds does not mean any ERC-20 is
 * safe to stake: the escrow records the pot as the amount it asked for, never
 * the amount that arrived, so a fee-on-transfer or rebasing token leaves it
 * holding less than it believes and settlement reverts permanently with both
 * stakes trapped. See the matching note in backend/src/web3/tokens.ts.
 *
 * Must stay in sync with that file — tokens-in-sync.test.ts enforces it.
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
    {
      address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      symbol: "cbBTC",
      name: "Coinbase Wrapped BTC",
      decimals: 8,
      minStake: 2_000n, // 0.00002 cbBTC
      stakeStep: "0.0001",
    },
    {
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      minStake: 1_000_000_000_000_000_000n, // 1 DAI
      stakeStep: "1",
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
