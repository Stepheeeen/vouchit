/**
 * Display helpers for crypto-denominated amounts.
 *
 * Wager amounts arrive from the API as base-unit strings (wei / USDC
 * micro-units) alongside the token's symbol and decimals, so formatting never
 * needs a price lookup or a Number round-trip.
 */

/** Convert base units to a decimal string, trimming trailing zeros. */
export function formatUnitsString(base: string | bigint, decimals: number): string {
  let value: bigint;
  try {
    value = typeof base === "bigint" ? base : BigInt(base ?? "0");
  } catch {
    return "0";
  }
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

interface TokenAmountSource {
  tokenSymbol?: string;
  tokenDecimals?: number;
}

/**
 * Format an amount for display, e.g. `formatStake(wager.totalPot, wager)` →
 * "50 USDC". Falls back gracefully when a record predates the token fields.
 */
export function formatStake(base: string | bigint | undefined | null, token: TokenAmountSource): string {
  if (base === undefined || base === null) return "—";
  const decimals = token.tokenDecimals ?? 18;
  const symbol = token.tokenSymbol ?? "";
  const amount = formatUnitsString(base, decimals);
  return symbol ? `${amount} ${symbol}` : amount;
}

/** Compact form for dense lists — caps the fraction at `maxFraction` digits. */
export function formatStakeCompact(
  base: string | bigint | undefined | null,
  token: TokenAmountSource,
  maxFraction = 4,
): string {
  if (base === undefined || base === null) return "—";
  const decimals = token.tokenDecimals ?? 18;
  const symbol = token.tokenSymbol ?? "";
  const full = formatUnitsString(base, decimals);
  const [whole, fraction] = full.split(".");
  const trimmed = fraction ? `${whole}.${fraction.slice(0, maxFraction).replace(/0+$/, "")}` : whole;
  const clean = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  return symbol ? `${clean} ${symbol}` : clean;
}

/** Protocol fee taken by the escrow on settlement, in base units. */
export const PROTOCOL_FEE_BPS = 250n;

export function applyProtocolFee(potBase: string | bigint): { fee: bigint; payout: bigint } {
  let pot: bigint;
  try {
    pot = typeof potBase === "bigint" ? potBase : BigInt(potBase ?? "0");
  } catch {
    pot = 0n;
  }
  const fee = (pot * PROTOCOL_FEE_BPS) / 10_000n;
  return { fee, payout: pot - fee };
}

/** Decimals for the tokens we support, keyed by symbol, for display only. */
const DISPLAY_DECIMALS: Record<string, number> = { USDC: 6, ETH: 18 };

/**
 * Render a per-token earnings map (`{ USDC: "125000000" }`) for a leaderboard
 * row. Amounts across different tokens are never summed — they're listed.
 */
export function formatEarnings(earningsByToken: Record<string, string> | undefined): string {
  const entries = Object.entries(earningsByToken ?? {}).filter(([, amount]) => amount && amount !== "0");
  if (entries.length === 0) return "—";
  return entries
    .map(([symbol, amount]) =>
      formatStakeCompact(amount, { tokenSymbol: symbol, tokenDecimals: DISPLAY_DECIMALS[symbol] ?? 18 }, 2),
    )
    .join(" · ");
}

/**
 * Sum an amount across wagers, grouped by token symbol. Returns the same shape
 * `formatEarnings` renders. Never collapses different tokens into one figure.
 */
export function sumByToken(
  wagers: Array<{ tokenSymbol?: string }>,
  amountOf: (wager: any) => bigint,
): Record<string, string> {
  const totals = new Map<string, bigint>();
  for (const wager of wagers) {
    const symbol = wager.tokenSymbol;
    if (!symbol) continue;
    totals.set(symbol, (totals.get(symbol) ?? 0n) + amountOf(wager));
  }
  return Object.fromEntries(Array.from(totals.entries()).map(([s, v]) => [s, v.toString()]));
}
