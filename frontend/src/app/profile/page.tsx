"use client";

import Link from "next/link";
import { ArrowLeft, Trophy, TrendingUp, Star, Flame, Crown, Zap, Shield, Edit2, Settings, Share2, ChevronRight } from "lucide-react";

const WAGER_HISTORY = [
  { desc: "Arsenal vs Chelsea",    result: "Won",  amount: "+₦10,000", date: "Apr 28" },
  { desc: "Man Utd vs City",       result: "Lost", amount: "−₦3,000",  date: "Apr 25" },
  { desc: "Lakers vs Nuggets",     result: "Won",  amount: "+₦8,000",  date: "Apr 20" },
  { desc: "Marathon challenge",    result: "Won",  amount: "+₦5,000",  date: "Apr 14" },
  { desc: "BTC to $100k bet",      result: "Won",  amount: "+₦12,000", date: "Apr 10" },
];

const BADGES = [
  { icon: Trophy, label: "10 Wins",     color: "text-amber-500",   bg: "bg-amber-50 border-amber-200"   },
  { icon: Zap,    label: "Hot Streak",  color: "text-[var(--primary)]", bg: "bg-[var(--muted)] border-[var(--border)]"  },
  { icon: Shield, label: "Fair Player", color: "text-[var(--success)]", bg: "bg-emerald-50 border-emerald-200" },
  { icon: Star,   label: "Top 10%",     color: "text-purple-500",  bg: "bg-purple-50 border-purple-200" },
];

export default function ProfilePage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Mobile sub-header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
        <Link href="/">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <h1 className="font-bold text-base flex-1">Profile</h1>
        <Link href="/settings">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <Settings className="h-4 w-4" />
          </button>
        </Link>
      </div>

      <main className="flex-1 w-full px-4 md:px-8 lg:px-12 py-6 md:py-8 flex flex-col gap-8">
        {/* Desktop title */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl tracking-tight">My Profile</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Your reputation, stats and wager history.</p>
          </div>
          <Link href="/settings">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm font-semibold hover:bg-[var(--muted)] transition-colors" style={{ boxShadow: "var(--shadow-sm)" }}>
              <Settings className="h-4 w-4" /> Settings
            </button>
          </Link>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT: Identity + Trust + Badges */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Avatar + Name */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="relative">
                <div
                  className="h-24 w-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg"
                  style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "0 8px 24px rgba(13,148,136,0.3)" }}
                >
                  JD
                </div>
                <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-white border-2 border-[var(--border)] flex items-center justify-center shadow-sm hover:bg-[var(--muted)] transition-colors">
                  <Edit2 className="h-3.5 w-3.5 text-[var(--foreground)]" />
                </button>
              </div>
              <div className="text-center">
                <h2 className="font-bold text-xl">John Doe</h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">+234 801 234 5678</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Member since Jan 2024</p>
              </div>
              <button className="flex items-center gap-2 text-xs font-semibold text-[var(--primary)] border border-[var(--border)] rounded-full px-4 py-1.5 hover:bg-[var(--muted)] transition-colors w-full justify-center">
                <Share2 className="h-3.5 w-3.5" /> Share Profile
              </button>
            </div>

            {/* Trust Score */}
            <div
              className="rounded-2xl p-5"
              style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "var(--shadow-md)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">Trust Score</p>
                  <p className="text-white font-bold text-4xl mt-1">94<span className="text-white/60 text-xl">/100</span></p>
                </div>
                <Shield className="h-12 w-12 text-white/30" />
              </div>
              <div className="h-2.5 bg-white/20 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-white rounded-full" style={{ width: "94%" }} />
              </div>
              <p className="text-white/60 text-[10px] font-semibold">Excellent — Fair player & on-time settler</p>
            </div>

            {/* Badges */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Achievements</p>
              <div className="grid grid-cols-4 gap-3">
                {BADGES.map((b, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className={`h-12 w-12 rounded-2xl ${b.bg} border flex items-center justify-center`} style={{ boxShadow: "var(--shadow-sm)" }}>
                      <b.icon className={`h-6 w-6 ${b.color}`} />
                    </div>
                    <p className="text-[9px] font-semibold text-center text-[var(--muted-foreground)] leading-tight">{b.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Stats + History */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Won",  value: "₦48,500", icon: TrendingUp, color: "text-[var(--primary)]" },
                { label: "Win Rate",   value: "80%",      icon: Trophy,    color: "text-[var(--success)]" },
                { label: "Wagers",     value: "15",       icon: Zap,       color: "text-amber-500"        },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <div className="h-10 w-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className={`font-bold text-2xl ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-[var(--muted-foreground)] font-semibold mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Win/Loss bar */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="flex justify-between text-sm font-semibold mb-3">
                <span className="text-[var(--success)]">Won: 12</span>
                <span className="text-[var(--muted-foreground)]">15 wagers total</span>
                <span className="text-[var(--danger)]">Lost: 3</span>
              </div>
              <div className="h-4 bg-[var(--muted)] rounded-full overflow-hidden flex">
                <div className="h-full bg-[var(--success)] rounded-l-full" style={{ width: "80%" }} />
                <div className="h-full bg-[var(--danger)] rounded-r-full flex-1" />
              </div>
              <p className="text-xs text-[var(--muted-foreground)] font-medium mt-2">80% win rate — top 10% of users</p>
            </div>

            {/* Wager history */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-base">Wager History</h2>
                <Link href="/wallet" className="text-xs font-semibold text-[var(--primary)] flex items-center gap-0.5 hover:underline">
                  Full ledger <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                {WAGER_HISTORY.map((w, i) => (
                  <div key={i} className={`flex items-center gap-4 p-4 hover:bg-[var(--muted)] transition-colors ${i < WAGER_HISTORY.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${w.result === "Won" ? "bg-emerald-50" : "bg-[var(--muted)]"}`}>
                      <Trophy className={`h-4 w-4 ${w.result === "Won" ? "text-[var(--success)]" : "text-[var(--danger)]"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{w.desc}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{w.date}</p>
                    </div>
                    <span className={`text-sm font-bold ${w.result === "Won" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{w.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
