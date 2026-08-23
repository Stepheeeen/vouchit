"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Shield, AlertCircle, CheckCircle2, ShieldCheck, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeb3 } from "@/context/Web3Context";
import { useEscrow } from "@/lib/web3/useEscrow";
import { findToken } from "@/lib/web3/tokens";
import { ACTIVE_CHAIN } from "@/lib/web3/config";
import { formatStake, applyProtocolFee } from "@/lib/web3/format";

export default function JoinVouchPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const { isConnected, isCorrectChain, isConnecting, connectWallet } = useWeb3();
  const { joinWager } = useEscrow();

  const [wager, setWager] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [status, setStatus] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [verification, setVerification] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { wagersApi, userApi, web3Api } = await import("@/lib/api");
        const [wagerData, profileData, verificationData] = await Promise.all([
          wagersApi.getById(id),
          userApi.getProfile().catch(() => null),
          // Fetched up front so the stake cap is enforced BEFORE the user pays
          // gas — a backend rejection after the on-chain join would strand
          // their funds in escrow with no record in the app.
          web3Api.getVerification().catch(() => null),
        ]);
        setWager(wagerData);
        setCurrentUserId(profileData?.id || null);
        setVerification(verificationData);
      } catch {
        setError("Could not load wager. It may not exist or have expired.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const isAlreadyParticipant = wager?.participants?.some((p: any) => p.userId === currentUserId);
  const isFull = wager?.participants?.length >= 2;
  const isNotAvailable = wager?.status !== "PENDING_FUNDING";

  // The stake is fixed by the escrow entry — a challenger always matches it.
  const requiredStake: string | undefined = wager?.onChainStake;
  const token = wager ? findToken(ACTIVE_CHAIN.id, wager.tokenAddress ?? "") : undefined;
  /**
   * Stake ceiling for this user's tier, or null when uncapped. Served by the
   * API so the limits live in one place rather than being duplicated here.
   */
  const tierMaxStake: bigint | null = (() => {
    const cap = token && verification?.stakeCaps?.[token.symbol];
    if (!cap) return null;
    try {
      return BigInt(cap);
    } catch {
      return null;
    }
  })();

  const exceedsTierCap = (() => {
    if (tierMaxStake === null || !requiredStake) return false;
    try {
      return BigInt(requiredStake) > tierMaxStake;
    } catch {
      return false;
    }
  })();

  const canJoin =
    !!requiredStake &&
    !!token &&
    isConnected &&
    isCorrectChain &&
    !exceedsTierCap &&
    !isAlreadyParticipant &&
    !isFull &&
    !isNotAvailable;

  const handleJoin = async () => {
    if (!canJoin || isJoining) return;
    setError("");
    setIsJoining(true);
    try {
      // Match the stake in the escrow contract first; the API only records the
      // join once the chain has accepted it.
      setStatus("Confirm the transaction in your wallet…");
      await joinWager(wager.contractWagerId, token!);

      setStatus("Confirming your position…");
      const { wagersApi } = await import("@/lib/api");
      await wagersApi.join(id);

      setJoined(true);
      setTimeout(() => router.push(`/vouch/${id}`), 1800);
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Failed to join wager.";
      setError(message);
      const { toast } = await import("sonner");
      toast.error(message);
    } finally {
      setIsJoining(false);
      setStatus("");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="font-bold uppercase tracking-widest text-[var(--muted-foreground)] text-sm animate-pulse">Loading wager...</div>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <div
          className="h-24 w-24 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#059669,#047857)", boxShadow: "0 0 40px rgba(5,150,105,0.3)" }}
        >
          <ShieldCheck className="h-12 w-12 text-white" />
        </div>
        <div className="text-center">
          <h2 className="font-bold text-2xl tracking-tight">You&apos;re In!</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Stake locked in escrow. The game is on.</p>
        </div>
      </div>
    );
  }

  if (!wager) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-[var(--danger)]" />
        <h2 className="font-bold text-xl">Wager Not Found</h2>
        <p className="text-sm text-[var(--muted-foreground)]">{error || "This wager doesn't exist or has expired."}</p>
        <Link href="/explore"><Button>Browse Wagers</Button></Link>
      </div>
    );
  }

  const creatorParticipant = wager.participants?.find((p: any) => p.side === "CREATOR");
  const creatorName = wager.creator?.displayName || wager.creator?.email?.split("@")[0] || "Creator";
  const creatorInitial = creatorName.charAt(0).toUpperCase();

  return (
    <div className="flex-1 flex flex-col bg-[var(--background)]">
      <header className="sticky top-0 md:top-[65px] z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
        <Link href="/explore">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-[var(--border)] transition-colors">
            <ArrowLeft className="h-4 w-4 text-[var(--foreground)]" />
          </button>
        </Link>
        <h1 className="font-bold text-base tracking-tight">Join Wager</h1>
      </header>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 md:p-8 gap-6 pb-32">

        {/* Status alerts */}
        {error && (
          <div className="flex items-start gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold rounded-xl">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {isAlreadyParticipant && (
          <div className="flex items-center gap-3 p-4 border border-[var(--primary)]/30 bg-teal-50 text-teal-700 text-sm font-semibold rounded-xl">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            You are already a participant in this wager.
          </div>
        )}
        {isFull && !isAlreadyParticipant && (
          <div className="flex items-center gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold rounded-xl">
            <AlertCircle className="h-5 w-5 shrink-0" />
            This wager is already full.
          </div>
        )}

        {/* Challenge card */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {creatorInitial}
            </div>
            <div>
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">Challenge from</p>
              <p className="text-white font-bold text-sm">{creatorName}</p>
            </div>
          </div>
          <p className="font-bold text-white text-xl leading-snug mb-6">&quot;{wager.description}&quot;</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Their Stake</p>
              <p className="text-white font-bold text-lg mt-1">{formatStake(creatorParticipant?.amount, wager)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-[var(--primary)] text-[10px] font-semibold uppercase tracking-widest">Total Pot</p>
              <p className="text-[var(--primary)] font-bold text-lg mt-1">{formatStake(wager.totalPot, wager)}</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Expires</p>
              <p className="text-white font-bold text-xs mt-1">
                {new Date(wager.expiresAt).toLocaleDateString("en-NG", { dateStyle: "short" })}
              </p>
            </div>
          </div>
        </div>

        {/* Your position — the stake is fixed by the escrow, so there is nothing to type */}
        {!isAlreadyParticipant && !isFull && !isNotAvailable && (
          <div className="bg-white border border-[var(--border)] rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4 flex items-center justify-between">
              <span>Your Position</span>
              <span className="text-[9px] bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Matched Stake
              </span>
            </p>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold tracking-tight">{formatStake(requiredStake, wager)}</span>
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)] font-semibold mb-3">
              Locked directly in the escrow contract on {ACTIVE_CHAIN.name} — Vouchit never holds it.
            </p>

            {!isConnected ? (
              <Button type="button" onClick={() => connectWallet()} disabled={isConnecting} className="w-full">
                {isConnecting ? "CONNECTING…" : "CONNECT WALLET TO JOIN"}
              </Button>
            ) : !isCorrectChain ? (
              <p className="text-xs text-[var(--danger)] font-semibold">
                Switch your wallet to {ACTIVE_CHAIN.name} to join this wager.
              </p>
            ) : exceedsTierCap ? (
              <p className="text-xs text-[var(--danger)] font-semibold">
                This stake is above your current limit of{" "}
                {formatStake(tierMaxStake?.toString(), wager)}. Verify your wallet to raise it —
                don&apos;t send the transaction, it can&apos;t be accepted.
              </p>
            ) : (
              <p className="text-xs text-[var(--success)] font-semibold">
                If you win: {formatStake(applyProtocolFee(BigInt(requiredStake ?? "0") * 2n).payout, wager)} after the 2.5% protocol fee.
              </p>
            )}
          </div>
        )}

        {/* How it works */}
        <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--primary)]" /> How it works
          </p>
          {[
            "Your stake is locked in the escrow contract immediately.",
            "When the event concludes, both parties agree on the winner.",
            "If you agree, the contract pays the winner automatically.",
            "Disagreements trigger a dispute with admin review.",
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
              <span className="h-5 w-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-xs text-[var(--muted-foreground)] font-medium leading-relaxed">{rule}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      {!isAlreadyParticipant && !isFull && !isNotAvailable && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)]/90 backdrop-blur-md border-t border-[var(--border)] z-20">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleJoin}
              disabled={!canJoin || isJoining}
              className="w-full py-4 rounded-2xl font-bold text-base text-white uppercase tracking-widest disabled:opacity-50 transition-all"
              style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 4px 20px rgba(13,148,136,0.35)" }}
            >
              {isJoining ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {status || "Locking Stake…"}
                </span>
              ) : `Accept & Lock ${formatStake(requiredStake, wager)}`}
            </button>
            <p className="text-center text-[10px] text-[var(--muted-foreground)] font-semibold mt-3 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3 text-[var(--primary)]" />
              Secured by the VouchitEscrow contract
            </p>
          </div>
        </div>
      )}
      {isAlreadyParticipant && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)] border-t border-[var(--border)] z-20">
          <div className="max-w-lg mx-auto">
            <Button className="w-full" onClick={() => router.push(`/vouch/${id}`)}>View My Wager</Button>
          </div>
        </div>
      )}
    </div>
  );
}
