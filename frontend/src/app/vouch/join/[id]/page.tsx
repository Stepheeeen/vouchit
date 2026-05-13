"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Users, ShieldCheck } from "lucide-react";

export default function JoinVouchPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [isFunding, setIsFunding] = useState(false);
  const [funded, setFunded] = useState(false);

  const wager = {
    id: params.id,
    creator: "Tunde A.",
    creatorInitial: "T",
    description: "Nigeria will qualify for the 2026 World Cup",
    stake: 25000,
    pot: 50000,
    expiresIn: "14 days",
    category: "Sports",
  };

  const handleFund = () => {
    setIsFunding(true);
    setTimeout(() => {
      setIsFunding(false);
      setFunded(true);
      setTimeout(() => router.push(`/vouch/${params.id}`), 1500);
    }, 1800);
  };

  if (funded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 animate-fade-in">
        <div
          className="h-24 w-24 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#059669,#047857)", boxShadow: "0 0 40px rgba(5,150,105,0.3)" }}
        >
          <ShieldCheck className="h-12 w-12 text-white" />
        </div>
        <div className="text-center">
          <h2 className="font-bold text-2xl tracking-tight text-[var(--foreground)]">You're In!</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Stake locked in escrow. The game is on.</p>
        </div>
      </div>
    );
  }

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

        {/* Challenge card */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "var(--shadow-lg)" }}
        >
          <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {wager.creatorInitial}
            </div>
            <div>
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">Challenge from</p>
              <p className="text-white font-bold text-sm">{wager.creator}</p>
            </div>
          </div>

          <p className="font-bold text-white text-xl leading-snug mb-6">"{wager.description}"</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Their Stake</p>
              <p className="text-white font-bold text-lg mt-1">₦{(wager.stake / 1000).toFixed(0)}k</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-[var(--primary)] text-[10px] font-semibold uppercase tracking-widest">Total Pot</p>
              <p className="text-[var(--primary)] font-bold text-lg mt-1">₦{(wager.pot / 1000).toFixed(0)}k</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Expires</p>
              <p className="text-white font-bold text-sm mt-1">{wager.expiresIn}</p>
            </div>
          </div>
        </div>

        {/* Your position */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Your Position</p>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">You stake</span>
              <span className="font-bold text-2xl text-[var(--primary)]">₦{(wager.stake / 1000).toFixed(0)},000</span>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">If you win</span>
              <span className="font-bold text-2xl text-[var(--success)]">₦{((wager.pot * 0.975) / 1000).toFixed(1)}k</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">after 2.5% fee</span>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="bg-[var(--muted)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
            How it works
          </p>
          {[
            "Your stake is locked in escrow immediately.",
            "When the event concludes, both parties must agree on the winner.",
            "If you agree, funds are released instantly to the winner.",
            "If you disagree, a dispute is opened for admin review.",
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
              <span className="h-5 w-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-xs text-[var(--muted-foreground)] font-medium leading-relaxed">{rule}</p>
            </div>
          ))}
        </div>

        {/* Challenger stats */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold"
              style={{ background: "linear-gradient(135deg,#0d9488,#115e59)" }}
            >
              {wager.creatorInitial}
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">{wager.creator}</p>
              <p className="text-xs text-[var(--muted-foreground)]">Trust Score: 91/100 · 8 wins</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--success)] bg-emerald-50 px-2 py-1 rounded-full">
              <Trophy className="h-3 w-3" /> 75% win rate
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)]/90 backdrop-blur-md border-t border-[var(--border)] z-20">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleFund}
            disabled={isFunding}
            className="w-full py-4 rounded-2xl font-bold text-base text-white uppercase tracking-widest disabled:opacity-70 transition-all"
            style={{
              background: "linear-gradient(135deg,#0d9488,#0f766e)",
              boxShadow: "0 4px 20px rgba(13,148,136,0.35)",
            }}
          >
            {isFunding ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Locking Stake…
              </span>
            ) : (
              `Accept & Lock ₦${(wager.stake / 1000).toFixed(0)},000`
            )}
          </button>
          <p className="text-center text-[10px] text-[var(--muted-foreground)] font-semibold mt-3 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3 w-3 text-[var(--primary)]" />
            Secured by Vouchit escrow engine
          </p>
        </div>
      </div>
    </div>
  );
}
