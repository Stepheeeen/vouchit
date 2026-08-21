"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, AlertCircle, Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeb3 } from "@/context/Web3Context";
import { useEscrow } from "@/lib/web3/useEscrow";
import { getTokens } from "@/lib/web3/tokens";
import { ACTIVE_CHAIN, isEscrowConfigured } from "@/lib/web3/config";
import { formatUnits, parseUnits } from "viem";

const PROTOCOL_FEE_BPS = 250n;
const BPS = 10_000n;

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
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const token = useMemo(
    () => tokens.find((t) => t.address === tokenAddress) ?? tokens[0],
    [tokens, tokenAddress],
  );

  /** Parsed stake in base units, or null when the input isn't a valid amount. */
  const stakeAmount = useMemo(() => {
    if (!stake || !token) return null;
    try {
      return parseUnits(stake, token.decimals);
    } catch {
      return null;
    }
  }, [stake, token]);

  const isStakeValid = stakeAmount !== null && token !== undefined && stakeAmount >= token.minStake;
  const isDescValid = description.length >= 10 && description.length <= 280;
  const isValid = isStakeValid && isDescValid && isConnected && isCorrectChain;

  const minStakeLabel = token ? `${formatUnits(token.minStake, token.decimals)} ${token.symbol}` : "";

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
    }
  };

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
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full md:bg-[var(--background)] md:border md:border-[var(--border)] overflow-hidden">
        <header className="sticky top-0 md:top-[65px] z-10 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] flex items-center p-4">
          <Link href="/dashboard" className="mr-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Create Vouch</h1>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-8 pb-24">
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
            <div className="grid grid-cols-2 gap-0 border border-[var(--border)]">
              {tokens.map((t, i) => (
                <div
                  key={t.address}
                  onClick={() => setTokenAddress(t.address)}
                  className={`p-4 cursor-pointer transition-colors ${i < tokens.length - 1 ? "border-r border-[var(--border)]" : ""} ${
                    tokenAddress === t.address
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "bg-transparent hover:bg-[var(--muted)]/50"
                  }`}
                >
                  <div className="font-semibold uppercase tracking-widest text-xs">{t.symbol}</div>
                  <div
                    className={`text-[10px] mt-2 font-medium leading-tight ${
                      tokenAddress === t.address ? "text-[var(--background)]/80" : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {t.name} on {ACTIVE_CHAIN.name}
                  </div>
                </div>
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
              {stake && !isStakeValid && (
                <span className="text-xs font-semibold text-[var(--danger)]">Minimum stake is {minStakeLabel}.</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Wager Type</label>
              <div className="grid grid-cols-2 gap-0 border border-[var(--border)]">
                <div
                  onClick={() => setIsSymmetric(true)}
                  className={`p-4 cursor-pointer transition-colors border-r border-[var(--border)] ${isSymmetric ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-transparent hover:bg-[var(--muted)]/50"}`}
                >
                  <div className="font-semibold uppercase tracking-widest text-xs">Symmetric</div>
                  <div className={`text-[10px] mt-2 font-medium leading-tight ${isSymmetric ? "text-[var(--background)]/80" : "text-[var(--muted-foreground)]"}`}>Opponent matches your stake exactly.</div>
                </div>
                <div
                  onClick={() => setIsSymmetric(false)}
                  className={`p-4 cursor-pointer transition-colors ${!isSymmetric ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-transparent hover:bg-[var(--muted)]/50"}`}
                >
                  <div className="font-semibold uppercase tracking-widest text-xs">Custom</div>
                  <div className={`text-[10px] mt-2 font-medium leading-tight ${!isSymmetric ? "text-[var(--background)]/80" : "text-[var(--muted-foreground)]"}`}>Opponent can set a different stake.</div>
                </div>
              </div>
            </div>
          </section>

          {/* Expiry */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Expiry</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="flex h-16 w-full border border-[var(--border)] bg-transparent px-4 text-base font-semibold uppercase tracking-widest focus-visible:outline-none focus-visible:border-[var(--foreground)] appearance-none rounded-none"
            >
              <option value="1">24 Hours</option>
              <option value="3">3 Days</option>
              <option value="7">1 Week</option>
              <option value="30">1 Month</option>
            </select>
          </section>

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

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)] border-t border-[var(--border)] flex justify-center z-20">
          <div className="w-full max-w-2xl">
            <Button onClick={handleSubmit} disabled={!isValid || isLoading || !isEscrowConfigured()} className="w-full">
              {isLoading ? (status || "LOCKING FUNDS…").toUpperCase() : "LOCK STAKE IN ESCROW"}
              {!isLoading && <ArrowRight className="ml-3 h-5 w-5" />}
            </Button>
            {account && (
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
