/**
 * Stake currencies the API will accept, keyed by chain id.
 *
 * Vouchit is crypto-denominated end to end: a stake IS an amount of one of these
 * tokens, so the escrow's on-chain stake can be compared to the submitted amount
 * exactly, with no price oracle in the path.
 *
 * Must stay in sync with frontend/src/lib/web3/tokens.ts.
 *
 * This is an ALLOWLIST, not a filter, and deliberately so. Because Vouchit
 * never holds the funds it is tempting to let people stake any ERC-20 they
 * like — but the escrow records `totalPot += stakeAmount` and never checks
 * what actually arrived. A fee-on-transfer token (one that keeps a cut of
 * every transfer, which is ordinary behaviour for a whole class of real
 * tokens) therefore leaves the contract holding less than it thinks it has,
 * and settlement reverts FOREVER with both stakes trapped inside. Rebasing
 * tokens break it the same way. Demonstrated against a 1% fee token: a
 * 20-token pot, 19.8 held, settlement permanently impossible.
 *
 * So only tokens with plain, well-understood transfer semantics belong here,
 * and each address below was read off Base mainnet rather than copied from
 * memory — a wrong address is lost money.
 */
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface StakeToken {
  address: string;
  symbol: string;
  decimals: number;
  /** Smallest accepted stake, in base units. */
  minStake: bigint;
  /**
   * Maximum stake per verification tier, in base units, indexed by tier.
   * `null` means uncapped. Tiers bound blast radius, not withdrawals — we hold
   * no funds to withhold.
   */
  tierMaxStake: (bigint | null)[];
}

const BASE_MAINNET = 8453;
const BASE_SEPOLIA = 84532;
/**
 * Hardhat's default chain id, used by the local end-to-end suite. Only reachable
 * when WEB3_CHAIN_ID is set to it explicitly; the default is Base Sepolia, so a
 * real deploy can never land here by accident. Native ETH only — a local mock
 * ERC20 has a fresh address on every run, so it cannot be listed statically.
 */
const LOCAL_CHAIN = 31337;

const TOKENS_BY_CHAIN: Record<number, StakeToken[]> = {
  [BASE_MAINNET]: [
    {
      address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      symbol: 'USDC',
      decimals: 6,
      minStake: 1_000_000n,
      // 25 / 250 / uncapped USDC
      tierMaxStake: [25_000_000n, 250_000_000n, null],
    },
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
      minStake: 200_000_000_000_000n,
      // 0.01 / 0.1 / uncapped ETH
      tierMaxStake: [10_000_000_000_000_000n, 100_000_000_000_000_000n, null],
    },
    {
      // Coinbase Wrapped BTC. Bitcoin is what a lot of people actually hold
      // and want to bet with; 8 decimals, like BTC itself.
      address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
      symbol: 'cbBTC',
      decimals: 8,
      minStake: 2_000n, // 0.00002 cbBTC
      // Sized to roughly match the USDC caps in dollar terms.
      tierMaxStake: [35_000n, 350_000n, null],
    },
    {
      address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
      symbol: 'DAI',
      decimals: 18,
      minStake: 1_000_000_000_000_000_000n, // 1 DAI
      // 25 / 250 / uncapped DAI, matching USDC.
      tierMaxStake: [25_000_000_000_000_000_000n, 250_000_000_000_000_000_000n, null],
    },
  ],
  [LOCAL_CHAIN]: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
      minStake: 1_000_000_000_000_000n, // 0.001 ETH
      tierMaxStake: [10_000_000_000_000_000n, 100_000_000_000_000_000n, null],
    },
  ],
  [BASE_SEPOLIA]: [
    {
      address: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
      symbol: 'USDC',
      decimals: 6,
      minStake: 1_000_000n,
      tierMaxStake: [25_000_000n, 250_000_000n, null],
    },
    {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
      minStake: 200_000_000_000_000n,
      tierMaxStake: [10_000_000_000_000_000n, 100_000_000_000_000_000n, null],
    },
  ],
};

/** Chain the API is configured against. Defaults to Sepolia so a misconfigured
 *  deploy can never silently accept mainnet funds. */
export function getChainId(): number {
  const configured = Number(process.env.WEB3_CHAIN_ID);
  return Number.isFinite(configured) && configured > 0 ? configured : BASE_SEPOLIA;
}

/** Every supported stake token on the configured chain. */
export function getTokens(): StakeToken[] {
  return TOKENS_BY_CHAIN[getChainId()] ?? [];
}

export function findToken(address: string): StakeToken | undefined {
  return getTokens().find((t) => t.address === address?.toLowerCase());
}

/**
 * Parse a human-readable decimal amount ("25", "0.001") into base units without
 * going through Number — a float round-trip loses precision at 18 decimals.
 */
export function parseTokenAmount(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value ?? '')) {
    throw new Error('Stake must be a positive decimal amount');
  }
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Stake has more than ${decimals} decimal places`);
  }
  return BigInt(whole + fraction.padEnd(decimals, '0'));
}

/** Inverse of parseTokenAmount, for display and API responses. */
export function formatTokenAmount(base: bigint, decimals: number): string {
  const negative = base < 0n;
  const digits = (negative ? -base : base).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
