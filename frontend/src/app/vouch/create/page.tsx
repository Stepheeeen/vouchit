"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, AlertCircle, Wallet, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeb3 } from "@/context/Web3Context";
import { useEscrow, type EscrowProgress } from "@/lib/web3/useEscrow";
import { getTokens } from "@/lib/web3/tokens";
import { useTokenBalance, useGasBalance, useUsdPrice, toUsd } from "@/lib/web3/useWalletMoney";
import { ACTIVE_CHAIN, isEscrowConfigured } from "@/lib/web3/config";
import { formatUnits, parseUnits, isAddress, zeroAddress } from "viem";

const PROTOCOL_FEE_BPS = 250n;
const BPS = 10_000n;

/** Must match WAGER_CATEGORIES on the API, and Explore's filter chips. */
const CATEGORIES = [
  { value: "SPORTS", label: "Sports" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "LIFESTYLE", label: "Lifestyle" },
  { value: "ENTERTAINMENT", label: "Entertainment" },
  { value: "FINANCE", label: "Finance" },
  { value: "OTHER", label: "Other" },
];

export default function CreateVouchPage() {
  const router = useRouter();
  const { account, isConnected, isCorrectChain, isConnecting, connectWallet } = useWeb3();
  const { createWager } = useEscrow();

  const tokens = getTokens(ACTIVE_CHAIN.id);
  const [tokenAddress, setTokenAddress] = useState(tokens[0]?.address ?? "");
  const [description, setDescription] = useState("");
  const [stake, setStake] = useState("");
  const [isSymmetric, setIsSymmetric] = useState(true);
  const [expiryDays, setExpiryDays] = useState("1");
  const [category, setCategory] = useState("OTHER");
  // Blank means anyone may join. There was no way to name an opponent at all,
  // so every wager created here was open to strangers — while the Join page
  // told people to ask the creator for an invite code that could not exist.
  const [opponent, setOpponent] = useState("");
  const [verification, setVerification] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  // The flow is up to three transactions with mining waits between them. It
  // used to report a single sentence and then go quiet, so the honest read
  // from the user's side was that it had hung.
  const [progress, setProgress] = useState<EscrowProgress | null>(null);
  const [error, setError] = useState("");

  // The tier decides the stake ceiling. Fetched up front so the limit can be
  // shown and enforced BEFORE the user pays gas — a server-side rejection
  // after the stake is escrowed strands their funds with no wager to show.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { web3Api } = await import("@/lib/api");
        const data = await web3Api.getVerification();
        if (!cancelled) setVerification(data);
      } catch {
        // Not signed in, or the call failed: fall back to no client-side cap
        // and let the API be the authority.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const token = useMemo(
    () => tokens.find((t) => t.address === tokenAddress) ?? tokens[0],
    [tokens, tokenAddress],
  );

  const balance = useTokenBalance(token);
  const gas = useGasBalance();
  const usdPrice = useUsdPrice(token?.symbol);

  /** Parsed stake in base units, or null when the input isn't a valid amount. */
  const stakeAmount = useMemo(() => {
    if (!stake || !token) return null;
    try {
      return parseUnits(stake, token.decimals);
    } catch {
      return null;
    }
  }, [stake, token]);

  /** Tier stake ceiling for the selected token, in base units. */
  const maxStake = useMemo(() => {
    const raw = verification?.stakeCaps?.[token?.symbol ?? ""];
    if (raw === undefined || raw === null) return null;
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  }, [verification, token]);

  const isAboveCap = stakeAmount !== null && maxStake !== null && stakeAmount > maxStake;
  const isBelowMin = stakeAmount !== null && token !== undefined && stakeAmount < token.minStake;

  /**
   * Can this wallet actually pay?
   *
   * Two separate ways to be short, and the app checked neither — it let you
   * fill the form, sign, and learn from the wallet's own rejection. For a
   * native-coin stake the gas comes out of the same balance, so the stake
   * alone being affordable is not enough.
   */
  const hasBalance =
    balance.value === null || stakeAmount === null ? true : balance.value >= stakeAmount;
  // Enough native coin to pay for a transaction at all. Base fees are tiny;
  // this is a floor to catch a wallet holding literally nothing.
  const GAS_FLOOR = 20_000_000_000_000n; // 0.00002 ETH
  const hasGas = gas.value === null ? true : gas.value >= GAS_FLOOR;

  const isStakeValid =
    stakeAmount !== null && token !== undefined && !isBelowMin && !isAboveCap && hasBalance;
  const isDescValid = description.length >= 10 && description.length <= 280;

  const opponentTrimmed = opponent.trim();
  const isOpponentValid = opponentTrimmed === "" || isAddress(opponentTrimmed);
  const isOpenWager = opponentTrimmed === "";

  const isValid =
    isStakeValid && isDescValid && isOpponentValid && isConnected && isCorrectChain && hasGas;

  const minStakeLabel = token ? `${formatUnits(token.minStake, token.decimals)} ${token.symbol}` : "";
  const stakeUsd = toUsd(stakeAmount, token?.decimals ?? 18, usdPrice);
  const maxStakeLabel =
    token && maxStake !== null ? `${formatUnits(maxStake, token.decimals)} ${token.symbol}` : null;

  /**
   * Why the submit button is disabled.
   *
   * It used to just sit there inert: a filled-in form, a big primary button,
   * and clicking it produced nothing at all — no message, no hint that a
   * wallet was needed.
   */
  const blockedReason = (() => {
    if (!isEscrowConfigured()) return "On-chain wagers are not configured for this environment.";
    if (!isConnected) return "Connect your wallet to lock a stake.";
    if (!isCorrectChain) return `Switch your wallet to ${ACTIVE_CHAIN.name}.`;
    if (!isDescValid)
      return description.length < 10
        ? "Describe the wager in at least 10 characters."
        : "Keep the description under 280 characters.";
    if (stakeAmount === null) return "Enter a stake amount.";
    if (isBelowMin) return `Minimum stake is ${minStakeLabel}.`;
    if (isAboveCap) return `Your tier allows stakes up to ${maxStakeLabel}.`;
    if (!hasBalance) return `Not enough ${token?.symbol}. Add funds from your wallet page.`;
    if (!hasGas) return "You need a little ETH on Base to pay the network fee.";
    if (!isOpponentValid) return "That opponent address is not a valid wallet address.";
    return null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading || !token || stakeAmount === null) return;
    setError("");
    setIsLoading(true);

    try {
      // Escrow the stake on-chain FIRST. The id is only registered with the API
      // after the transaction is mined, so the backend always verifies against a
      // real, funded wager.
      setStatus("Confirm the transaction in your wallet…");
      const { wagerId } = await createWager({
        token,
        stake,
        expiryDays: Number(expiryDays),
        onProgress: setProgress,
        // The chain is what actually restricts who may join; the API mirrors
        // this value rather than trusting a separate client field.
        challenger: isOpenWager ? zeroAddress : (opponentTrimmed as `0x${string}`),
      });

      setStatus("Registering your wager…");
      const { wagersApi } = await import("@/lib/api");
      const wager = await wagersApi.create(
        description,
        stake,
        token.address,
        isSymmetric,
        Number(expiryDays),
        wagerId,
        category,
      );
      router.push(`/vouch/${wager.id}/invite`);
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Failed to create wager. Please try again.";
      setError(message);
      const { toast } = await import("sonner");
      toast.error(message);
    } finally {
      setIsLoading(false);
      setStatus("");
      setProgress(null);
    }
  };

  /** Plain-language account of which transaction is in flight. */
  const progressLabel = (() => {
    if (!progress) return null;
    switch (progress.step) {
      case "approving":
        return `Approve ${token?.symbol} in your wallet — this lets the escrow move your stake.`;
      case "awaiting-approval":
        return "Waiting for the approval to confirm on Base…";
      case "signing":
        return "Confirm the stake in your wallet…";
      case "confirming":
        return "Locking your stake in escrow…";
    }
  })();

  const progressHash = progress && "hash" in progress ? progress.hash : undefined;
  const explorerBase =
    ACTIVE_CHAIN.id === 8453 ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";

  const potPreview = () => {
    if (!token || stakeAmount === null) return null;
    const pot = isSymmetric ? stakeAmount * 2n : stakeAmount;
    const fee = (pot * PROTOCOL_FEE_BPS) / BPS;
    return {
      pot: formatUnits(pot, token.decimals),
      fee: formatUnits(fee, token.decimals),
      payout: formatUnits(pot - fee, token.decimals),
    };
  };
  const preview = potPreview();

  return (
    <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto md:py-8 tracking-tight">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full md:bg-[var(--background)] md:border md:border-[var(--border)]">
        <header className="z-10 bg-[var(--background)] border-b border-[var(--border)] flex items-center p-4">
          <Link href="/dashboard" className="mr-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Create Vouch</h1>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col p-4 gap-8 pb-[calc(var(--mobile-nav-h)+7rem)] md:pb-28"
        >
          {!isEscrowConfigured() && (
            <div className="flex items-start gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              On-chain wagers are unavailable — the escrow contract isn&apos;t configured for this environment.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Wallet gate — the stake is escrowed from the user's own wallet. */}
          {!isConnected ? (
            <section className="flex flex-col gap-3 border border-[var(--border)] p-6 items-start">
              <div className="font-semibold uppercase tracking-widest text-xs">Wallet required</div>
              <p className="text-xs text-[var(--muted-foreground)] font-medium leading-relaxed">
                Your stake is locked in the escrow contract, not held by Vouchit. Sign in with a
                passkey — no extension or seed phrase needed.
              </p>
              <Button type="button" onClick={() => connectWallet()} disabled={isConnecting} className="mt-2">
                <Wallet className="mr-3 h-5 w-5" />
                {isConnecting ? "CONNECTING…" : "CONNECT WALLET"}
              </Button>
            </section>
          ) : !isCorrectChain ? (
            <div className="flex items-start gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              Switch your wallet to {ACTIVE_CHAIN.name} to create a wager.
            </div>
          ) : null}

          {/* Currency */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Stake Currency</label>
            {/*
              Radio inputs, not click-handled divs. The previous markup was
              invisible to the accessibility tree and unreachable by keyboard,
              so the stake currency could only be chosen with a mouse.
            */}
            <div role="radiogroup" aria-label="Stake currency" className="grid grid-cols-2 gap-0 border border-[var(--border)]">
              {tokens.map((t, i) => (
                <label
                  key={t.address}
                  className={`p-4 cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-[var(--primary)] ${i < tokens.length - 1 ? "border-r border-[var(--border)]" : ""} ${
                    tokenAddress === t.address
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "bg-transparent hover:bg-[var(--muted)]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="stake-currency"
                    value={t.address}
                    checked={tokenAddress === t.address}
                    onChange={() => setTokenAddress(t.address)}
                    className="sr-only"
                  />
                  <div className="font-semibold uppercase tracking-widest text-xs">{t.symbol}</div>
                  <div
                    className={`text-[10px] mt-2 font-medium leading-tight ${
                      tokenAddress === t.address ? "text-[var(--background)]/80" : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {t.name} on {ACTIVE_CHAIN.name}
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Description */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">The Wager</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Arsenal will win the Premier League this season"
              className="w-full min-h-[120px] resize-none border border-[var(--border)] bg-transparent px-4 py-4 text-base focus-visible:outline-none focus-visible:border-[var(--foreground)] transition-colors"
              maxLength={280}
            />
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-1">
              <span>Be verifiable and clear.</span>
              <span className={description.length > 280 ? "text-[var(--danger)]" : ""}>{description.length}/280</span>
            </div>
          </section>

          {/* Stake */}
          <section className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Your Stake</label>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  step={token?.stakeStep}
                  placeholder={token?.stakeStep}
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="pr-24 text-2xl font-bold h-16 rounded-none focus-visible:ring-0 focus-visible:border-[var(--foreground)]"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-sm uppercase tracking-widest text-[var(--muted-foreground)]">
                  {token?.symbol}
                </span>
              </div>
              {/* What you hold, what this costs in money people think in, and
                  a one-tap Max. The stake field previously showed none of it,
                  so you typed a number blind and found out at signing time. */}
              <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                <span>
                  Balance{" "}
                  {balance.isLoading
                    ? "…"
                    : balance.value === null
                      ? "—"
                      : `${formatUnits(balance.value, token?.decimals ?? 18)} ${token?.symbol ?? ""}`}
                </span>
                {balance.value !== null && balance.value > 0n && token && (
                  <button
                    type="button"
                    onClick={() => setStake(formatUnits(balance.value!, token.decimals))}
                    className="underline underline-offset-2 hover:text-[var(--foreground)] transition-colors"
                  >
                    Use max
                  </button>
                )}
              </div>
              <div className="flex justify-between gap-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                <span>
                  Min {minStakeLabel}
                  {stakeUsd && <span className="normal-case"> · about {stakeUsd}</span>}
                </span>
                {maxStakeLabel && <span>Your limit {maxStakeLabel}</span>}
              </div>
              {stake && isBelowMin && (
                <span className="text-xs font-semibold text-[var(--danger)]">Minimum stake is {minStakeLabel}.</span>
              )}
              {stake && !hasBalance && (
                <span className="text-xs font-semibold text-[var(--danger)]">
                  That is more {token?.symbol} than this wallet holds. Add funds from the{" "}
                  <Link href="/wallet" className="underline">wallet page</Link>.
                </span>
              )}
              {!hasGas && (
                // Holding USDC and no ETH is a real and confusing dead end:
                // every Base transaction is paid for in ETH, so the stake
                // being affordable is not sufficient on its own.
                <span className="text-xs font-semibold text-[var(--danger)]">
                  You have no ETH on Base to pay the network fee. You need a small amount
                  even when staking USDC.
                </span>
              )}
              {stake && isAboveCap && (
                // Caught here rather than after the escrow transaction, which
                // would leave the stake locked on-chain with nothing to show
                // for it. 999,999 USDC used to be accepted without a murmur.
                <span className="text-xs font-semibold text-[var(--danger)]">
                  Your current tier allows stakes up to {maxStakeLabel}. Build a settlement record to raise it.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Wager Type</label>
              <div role="radiogroup" aria-label="Wager type" className="grid grid-cols-2 gap-0 border border-[var(--border)]">
                <label
                  className={`p-4 cursor-pointer transition-colors border-r border-[var(--border)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-[var(--primary)] ${isSymmetric ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-transparent hover:bg-[var(--muted)]/50"}`}
                >
                  <input
                    type="radio"
                    name="wager-type"
                    checked={isSymmetric}
                    onChange={() => setIsSymmetric(true)}
                    className="sr-only"
                  />
                  <div className="font-semibold uppercase tracking-widest text-xs">Symmetric</div>
                  <div className={`text-[10px] mt-2 font-medium leading-tight ${isSymmetric ? "text-[var(--background)]/80" : "text-[var(--muted-foreground)]"}`}>Opponent matches your stake exactly.</div>
                </label>
                <label
                  className={`p-4 cursor-pointer transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-[var(--primary)] ${!isSymmetric ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-transparent hover:bg-[var(--muted)]/50"}`}
                >
                  <input
                    type="radio"
                    name="wager-type"
                    checked={!isSymmetric}
                    onChange={() => setIsSymmetric(false)}
                    className="sr-only"
                  />
                  <div className="font-semibold uppercase tracking-widest text-xs">Custom</div>
                  <div className={`text-[10px] mt-2 font-medium leading-tight ${!isSymmetric ? "text-[var(--background)]/80" : "text-[var(--muted-foreground)]"}`}>Opponent can set a different stake.</div>
                </label>
              </div>
            </div>
          </section>

          {/* Opponent */}
          <section className="flex flex-col gap-3">
            <label
              htmlFor="opponent"
              className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]"
            >
              Opponent <span className="normal-case tracking-normal font-medium">(optional)</span>
            </label>
            <Input
              id="opponent"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="0x… wallet address, or leave blank"
              spellCheck={false}
              autoComplete="off"
              className="h-14 rounded-none font-mono text-sm focus-visible:ring-0 focus-visible:border-[var(--foreground)]"
              aria-describedby="opponent-help"
            />
            <p id="opponent-help" className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] leading-relaxed">
              {isOpenWager
                ? "Open wager — anyone can join it from Explore."
                : isOpponentValid
                  ? "Only this wallet can join. The escrow contract enforces it."
                  : "That is not a valid wallet address."}
            </p>
            {opponent && !isOpponentValid && (
              <span className="text-xs font-semibold text-[var(--danger)]">
                An opponent address must be a 42-character address starting with 0x.
              </span>
            )}
          </section>

          {/* Category */}
          <section className="flex flex-col gap-3">
            <label
              htmlFor="category"
              className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]"
            >
              Category
            </label>
            {/* Explore filters on this. It shipped with six filter chips and
                no way to set a category, so none of them ever matched. */}
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-16 w-full border border-[var(--border)] bg-transparent px-4 text-base font-semibold uppercase tracking-widest focus-visible:outline-none focus-visible:border-[var(--foreground)] rounded-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </section>

          {/* Expiry */}
          <section className="flex flex-col gap-3">
            <label
              htmlFor="expiry"
              className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]"
            >
              Expiry
            </label>
            {/* `appearance-none` is gone: it hid the dropdown arrow, so this
                read as static text and nobody knew it could be changed. The
                long options exist because the form's own example — "Arsenal
                will win the Premier League this season" — could not be
                created when a month was the maximum. */}
            <select
              id="expiry"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="flex h-16 w-full border border-[var(--border)] bg-transparent px-4 text-base font-semibold uppercase tracking-widest focus-visible:outline-none focus-visible:border-[var(--foreground)] rounded-none"
            >
              <option value="1">24 Hours</option>
              <option value="3">3 Days</option>
              <option value="7">1 Week</option>
              <option value="30">1 Month</option>
              <option value="90">3 Months</option>
              <option value="180">6 Months</option>
              <option value="365">1 Year</option>
            </select>
          </section>

          {/* Live transaction progress */}
          {isLoading && progressLabel && (
            <section className="flex items-start gap-3 p-4 border border-[var(--foreground)] bg-[var(--muted)]/20 text-sm font-semibold">
              <Loader2 className="h-5 w-5 shrink-0 mt-0.5 animate-spin" />
              <div className="flex flex-col gap-1">
                <span>{progressLabel}</span>
                {progressHash && (
                  <a
                    href={`${explorerBase}${progressHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-semibold uppercase tracking-widest underline underline-offset-2 text-[var(--muted-foreground)]"
                  >
                    View on Basescan
                  </a>
                )}
                <span className="text-[10px] font-medium normal-case text-[var(--muted-foreground)]">
                  Keep this page open until it finishes.
                </span>
              </div>
            </section>
          )}

          {/* Summary */}
          {preview && isDescValid && token && (
            <section className="border border-[var(--foreground)] p-6 flex flex-col gap-4 mt-4 bg-[var(--muted)]/10 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between text-[var(--foreground)] font-semibold text-xs uppercase tracking-widest border-b border-[var(--border)] pb-2">
                <span className="flex items-center gap-2"><Info className="h-4 w-4" /> Summary</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Total Pot (Est.)</span>
                <span className="font-bold text-2xl">
                  {preview.pot} {token.symbol}
                  {isSymmetric ? "" : " + ?"}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Protocol Fee (2.5%)</span>
                <span className="font-semibold text-sm">{isSymmetric ? `${preview.fee} ${token.symbol}` : "…"}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Winner Receives</span>
                <span className="font-semibold text-sm">{isSymmetric ? `${preview.payout} ${token.symbol}` : "…"}</span>
              </div>
              <div className="text-[10px] font-semibold text-[var(--muted-foreground)] leading-tight pt-4 mt-2 border-t border-[var(--border)]">
                YOUR STAKE IS LOCKED IN THE ESCROW CONTRACT — NOT HELD BY VOUCHIT. REFUNDED ON-CHAIN IF NO ONE JOINS BEFORE EXPIRY.
              </div>
            </section>
          )}
        </form>

        {/*
          Sits ABOVE the mobile tab bar.

          This was `fixed bottom-0 z-20` while AppNav's mobile nav is
          `fixed bottom-0 z-30`, so on a phone the tab bar rendered straight
          over the submit button: present in the DOM, invisible on screen, and
          impossible to tap. Creating a wager — the whole point of the app —
          could not be done on mobile at all. The offset clears the nav, and
          the form's bottom padding clears this bar.
        */}
        <div className="fixed bottom-[var(--mobile-nav-h)] md:bottom-0 left-0 right-0 p-4 bg-[var(--background)] border-t border-[var(--border)] flex justify-center z-20">
          <div className="w-full max-w-2xl">
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isLoading || !isEscrowConfigured()}
              className="w-full"
              aria-describedby={blockedReason ? "submit-blocked" : undefined}
            >
              {isLoading ? (status || "LOCKING FUNDS…").toUpperCase() : "LOCK STAKE IN ESCROW"}
              {!isLoading && <ArrowRight className="ml-3 h-5 w-5" />}
            </Button>
            {/* Say why it is disabled. Clicking an inert primary button and
                getting no response at all is the worst possible answer. */}
            {blockedReason && !isLoading && (
              <p
                id="submit-blocked"
                role="status"
                className="text-[10px] text-center mt-2 font-semibold uppercase tracking-widest text-[var(--muted-foreground)]"
              >
                {blockedReason}
              </p>
            )}
            {account && !blockedReason && (
              <p className="text-[10px] text-center mt-2 font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                {account.slice(0, 6)}…{account.slice(-4)} · {ACTIVE_CHAIN.name}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
