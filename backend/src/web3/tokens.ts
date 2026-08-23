/**
 * Stake currencies the API will accept, keyed by chain id.
 *
 * Vouchit is crypto-denominated end to end: a stake IS an amount of one of these
 * tokens, so the escrow's on-chain stake can be compared to the submitted amount
 * exactly, with no price oracle in the path.
 *
 * Must stay in sync with frontend/src/lib/web3/tokens.ts.
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
