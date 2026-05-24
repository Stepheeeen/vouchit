"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, TrendingUp, Star, Flame, Crown, Zap, Shield, Edit2, Settings, Share2, ChevronRight, Loader2 } from "lucide-react";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [wagers, setWagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { userApi, wagersApi } = await import("@/lib/api");
        const [profileData, wagersData] = await Promise.all([
          userApi.getProfile(),
          wagersApi.getMy().catch(() => []),
        ]);
        setUser(profileData);
        setWagers(wagersData);
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p>Could not load profile. Please log in.</p>
        <Link href="/auth/login" className="text-[var(--primary)] underline">Go to Login</Link>
      </div>
    );
  }

  const name = user.displayName || user.email.split("@")[0];
  const initials = getInitials(name);
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  // Calculate stats from settled wagers
  const settled = wagers.filter((w) => w.status === "SETTLED");
  const wonWagers = settled.filter((w) => w.winnerId === user.id);
  const lostWagers = settled.filter((w) => w.winnerId && w.winnerId !== user.id);
  
  const totalWonAmount = wonWagers.reduce((sum, w) => sum + (Number(w.totalPot) * 0.975), 0);
  const winRate = settled.length > 0 ? Math.round((wonWagers.length / settled.length) * 100) : 0;
  
  // Wager history mapping
  const history = wagers.slice(0, 10).map((w) => {
    const isWinner = w.winnerId === user.id;
    const isLoser = w.winnerId && w.winnerId !== user.id;
    const myParticipant = w.participants?.find((p: any) => p.userId === user.id);
    let result = "Pending";
    let amountStr = "—";
    
    if (w.status === "SETTLED") {
      result = isWinner ? "Won" : "Lost";
      amountStr = isWinner 
        ? `+₦${(Number(w.totalPot) * 0.975).toLocaleString()}` 
        : `−₦${Number(myParticipant?.amount || 0).toLocaleString()}`;
    } else if (w.status === "ACTIVE") {
      result = "Active";
      amountStr = `₦${Number(myParticipant?.amount || 0).toLocaleString()} (Stake)`;
    } else if (w.status === "DISPUTED") {
      result = "Disputed";
    }

    return {
      id: w.id,
      desc: w.description,
      result,
      amount: amountStr,
      date: new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });

  return (
    <div className="flex-1 flex flex-col">
      {/* Mobile sub-header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
        <Link href="/dashboard">
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

      <main className="flex-1 w-full px-4 md:px-8 lg:px-12 py-6 md:py-8 flex flex-col gap-8 tracking-tight">
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

          {/* LEFT: Identity + Trust */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Avatar + Name */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="relative">
                <div
                  className="h-24 w-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg"
                  style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "0 8px 24px rgba(13,148,136,0.3)" }}
                >
                  {initials}
                </div>
                <Link href="/settings" className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-white border-2 border-[var(--border)] flex items-center justify-center shadow-sm hover:bg-[var(--muted)] transition-colors">
                  <Edit2 className="h-3.5 w-3.5 text-[var(--foreground)]" />
                </Link>
              </div>
              <div className="text-center">
                <h2 className="font-bold text-xl">{name}</h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{user.email}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Member since {memberSince}</p>
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
              <p className="text-white/60 text-[10px] font-semibold">Excellent — Fair player</p>
            </div>
          </div>

          {/* RIGHT: Stats + History */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="h-10 w-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="font-bold text-xl md:text-2xl text-[var(--primary)] truncate">
                    ₦{(totalWonAmount / 1000).toFixed(1)}k
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] font-semibold mt-0.5">Total Won</p>
                </div>
              </div>
              <div className="bg-white border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="h-10 w-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-[var(--success)]" />
                </div>
                <div>
                  <p className="font-bold text-2xl text-[var(--success)]">{winRate}%</p>
                  <p className="text-xs text-[var(--muted-foreground)] font-semibold mt-0.5">Win Rate</p>
                </div>
              </div>
              <div className="bg-white border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="h-10 w-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-bold text-2xl text-amber-500">{wagers.length}</p>
                  <p className="text-xs text-[var(--muted-foreground)] font-semibold mt-0.5">Wagers</p>
                </div>
              </div>
            </div>

            {/* Win/Loss bar */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="flex justify-between text-sm font-semibold mb-3">
                <span className="text-[var(--success)]">Won: {wonWagers.length}</span>
                <span className="text-[var(--muted-foreground)]">{settled.length} settled wagers</span>
                <span className="text-[var(--danger)]">Lost: {lostWagers.length}</span>
              </div>
              <div className="h-4 bg-[var(--muted)] rounded-full overflow-hidden flex">
                <div className="h-full bg-[var(--success)] rounded-l-full transition-all" style={{ width: `${winRate}%` }} />
                <div className="h-full bg-[var(--danger)] rounded-r-full flex-1" />
              </div>
            </div>

            {/* Wager history */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-base">Wager History</h2>
                <Link href="/wallet" className="text-xs font-semibold text-[var(--primary)] flex items-center gap-0.5 hover:underline">
                  Full ledger <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              
              {history.length === 0 ? (
                <div className="bg-white border border-[var(--border)] rounded-2xl p-8 text-center text-[var(--muted-foreground)]">
                  <p className="text-sm">No wagers found.</p>
                </div>
              ) : (
                <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                  {history.map((w, i) => (
                    <Link key={w.id} href={`/vouch/${w.id}`}>
                      <div className={`flex items-center gap-4 p-4 hover:bg-[var(--muted)] transition-colors cursor-pointer ${i < history.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                          w.result === "Won" ? "bg-emerald-50" : 
                          w.result === "Lost" ? "bg-red-50" : 
                          "bg-[var(--muted)]"
                        }`}>
                          {w.result === "Won" && <Trophy className="h-4 w-4 text-[var(--success)]" />}
                          {w.result === "Lost" && <Shield className="h-4 w-4 text-[var(--danger)]" />}
                          {w.result !== "Won" && w.result !== "Lost" && <Zap className="h-4 w-4 text-[var(--muted-foreground)]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-[var(--foreground)]">{w.desc}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">{w.date} · {w.result}</p>
                        </div>
                        <span className={`text-sm font-bold ${
                          w.result === "Won" ? "text-[var(--success)]" : 
                          w.result === "Lost" ? "text-[var(--danger)]" : 
                          "text-[var(--muted-foreground)]"
                        }`}>
                          {w.amount}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
