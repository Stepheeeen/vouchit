"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Users, ArrowUpRight, ArrowDownRight,
  Flame, TrendingUp, ChevronRight, ShieldCheck, Clock, Loader2
} from "lucide-react";

const quickActions = [
  { href: "/vouch/create", icon: Plus,       label: "Create Wager", sub: "Start a new bet"   },
  { href: "/vouch/join",   icon: Users,      label: "Join Wager",   sub: "Enter invite code" },
  { href: "/explore",      icon: Flame,      label: "Explore",      sub: "Browse live bets"  },
  { href: "/leaderboard",  icon: TrendingUp, label: "Rankings",     sub: "Top earners"       },
];

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [wagers, setWagers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { userApi, wagersApi } = await import("@/lib/api");
        const [profile, myWagers] = await Promise.all([
          userApi.getProfile(),
          wagersApi.getMy().catch(() => []),
        ]);
        setUser(profile);
        setWagers(myWagers);
      } catch {
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  // Active or Pending wagers
  const activeWagers = wagers.filter(w => w.status === "ACTIVE" || w.status === "PENDING_FUNDING");
  
  // Settled wagers for stats
  const settledWagers = wagers.filter(w => w.status === "SETTLED");
  const wonWagers = settledWagers.filter(w => w.winnerId === user.id);
  const lostWagers = settledWagers.filter(w => w.winnerId && w.winnerId !== user.id);
  
  const winRate = settledWagers.length > 0 ? Math.round((wonWagers.length / settledWagers.length) * 100) : 0;
  const totalWonAmount = wonWagers.reduce((sum, w) => sum + (Number(w.totalPot) * 0.975), 0);
  const escrowAmount = Number(user.escrowBalance) || 0;
  const availableBalance = Number(user.availableBalance) || 0;

  // Generate recent activity from wagers
  const activity = wagers
    .filter(w => w.status === "SETTLED" || w.status === "ACTIVE")
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5)
    .map(w => {
      const myParticipant = w.participants?.find((p: any) => p.userId === user.id);
      if (w.status === "SETTLED") {
        const isWinner = w.winnerId === user.id;
        return {
          type: isWinner ? "win" : "loss",
          label: `${isWinner ? "Won" : "Lost"} Wager: ${w.description.slice(0, 20)}...`,
          amount: isWinner ? `+₦${(Number(w.totalPot) * 0.975).toLocaleString()}` : `−₦${Number(myParticipant?.amount || 0).toLocaleString()}`,
          time: new Date(w.updatedAt || w.createdAt).toLocaleDateString(),
          icon: isWinner ? ArrowUpRight : ArrowDownRight
        };
      } else {
        return {
          type: "deposit",
          label: `Staked on: ${w.description.slice(0, 20)}...`,
          amount: `−₦${Number(myParticipant?.amount || 0).toLocaleString()}`,
          time: new Date(w.createdAt).toLocaleDateString(),
          icon: ArrowDownRight
        };
      }
    });

  return (
    <div className="flex-1 flex flex-col">

      {/* ── Full-width content area ── */}
      <main className="flex-1 w-full px-4 md:px-8 lg:px-12 py-6 md:py-8 flex flex-col gap-8">

        {/* ── TOP SECTION: Wallet hero + Quick actions side-by-side on desktop ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Wallet Hero */}
          <div
            className="lg:col-span-2 rounded-2xl p-6 md:p-8 relative overflow-hidden"
            style={{
            background: "linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #115e59 100%)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10" />
            <div className="absolute -bottom-14 -right-4 h-40 w-40 rounded-full bg-white/5" />
            <div className="absolute top-4 right-4 opacity-10">
              <ShieldCheck className="h-32 w-32 text-white" />
            </div>

            <div className="relative z-10">
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">Available Balance</p>
              <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6">
                ₦{availableBalance.toLocaleString()}
              </p>

              <div className="flex flex-wrap items-center gap-4 bg-white/10 rounded-xl p-4">
                <div className="flex-1 min-w-[100px]">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">In Escrow</p>
                  <p className="text-white font-semibold text-base mt-0.5">₦{escrowAmount.toLocaleString()}</p>
                </div>
                <div className="h-8 w-px bg-white/20 hidden sm:block" />
                <div className="flex-1 min-w-[100px]">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">All-Time Won</p>
                  <p className="text-white font-semibold text-base mt-0.5">₦{totalWonAmount.toLocaleString()}</p>
                </div>
                <div className="h-8 w-px bg-white/20 hidden sm:block" />
                <div className="flex-1 min-w-[100px]">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">Win Rate</p>
                  <p className="text-white font-semibold text-base mt-0.5">{winRate}%</p>
                </div>
                <Link href="/wallet">
                  <button className="bg-white text-[var(--primary)] text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl hover:bg-[var(--muted)] transition-colors flex items-center gap-2 shadow-sm shrink-0">
                    Fund <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Actions (sidebar on large screens) */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-3">
            {quickActions.map((qa) => (
              <Link key={qa.href} href={qa.href}>
                <div
                  className="group bg-white border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3 hover:border-[var(--primary)] hover:shadow-md transition-all cursor-pointer h-full"
                  style={{ boxShadow: "var(--shadow-sm)" }}
                >
                  <div className="h-10 w-10 rounded-xl bg-[var(--muted)] group-hover:bg-[var(--primary)] flex items-center justify-center transition-colors flex-shrink-0">
                    <qa.icon className="h-5 w-5 text-[var(--primary)] group-hover:text-white transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[var(--foreground)] truncate">{qa.label}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 truncate">{qa.sub}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── MAIN CONTENT GRID: Wagers + Sidebar ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Active Wagers — 2/3 width on xl */}
          <section className="xl:col-span-2 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg tracking-tight">Active Wagers</h2>
              <Link href="/vouch" className="text-sm font-semibold text-[var(--primary)] flex items-center gap-0.5 hover:underline">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-4">
              {activeWagers.length === 0 ? (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-[var(--muted-foreground)] bg-white border border-[var(--border)] rounded-2xl border-dashed">
                  <p className="text-sm font-medium">You have no active wagers.</p>
                  <Link href="/vouch/create" className="text-[var(--primary)] text-xs mt-2 font-bold uppercase tracking-widest hover:underline">Create One Now</Link>
                </div>
              ) : activeWagers.map((w) => {
                const myParticipant = w.participants?.find((p: any) => p.userId === user.id);
                const expiresMs = new Date(w.expiresAt).getTime() - Date.now();
                const expiresLabel = expiresMs > 0 ? `${Math.round(expiresMs / 3600000)}h` : "Expired";

                return (
                  <Link key={w.id} href={`/vouch/${w.id}`}>
                    <div
                      className="group bg-white border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--primary)] hover:shadow-md transition-all cursor-pointer h-full flex flex-col justify-between gap-4"
                      style={{ boxShadow: "var(--shadow-sm)" }}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <p className="font-semibold text-sm leading-snug text-[var(--foreground)] line-clamp-2 flex-1">
                          {w.description}
                        </p>
                        {w.status === "ACTIVE" ? (
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-[var(--success)] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                            Live
                          </span>
                        ) : (
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" />
                            Waiting
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-end pt-3 border-t border-[var(--border)]">
                        <div>
                          <p className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">Your Stake</p>
                          <p className="font-semibold text-base text-[var(--foreground)] mt-0.5">₦{Number(myParticipant?.amount || 0).toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">Pot</p>
                          <p className="font-bold text-xl text-[var(--primary)] mt-0.5">₦{(Number(w.totalPot) / 1000).toFixed(0)}k</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">Expires</p>
                          <p className="font-semibold text-sm text-[var(--foreground)] mt-0.5">{expiresLabel}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Right Sidebar: Ledger + Stats */}
          <div className="flex flex-col gap-6 xl:col-span-1">

            {/* Stats mini card */}
            <div
              className="bg-white border border-[var(--border)] rounded-2xl p-5"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Your Stats</p>
              <div className="grid grid-cols-3 gap-3 text-center divide-x divide-[var(--border)]">
                {[
                  { label: "Won",    value: wonWagers.length.toString(),  color: "text-[var(--primary)]" },
                  { label: "Lost",   value: lostWagers.length.toString(),   color: "text-[var(--foreground)]" },
                  { label: "Rate",   value: `${winRate}%`, color: "text-[var(--success)]" },
                ].map((s) => (
                  <div key={s.label} className="px-2">
                    <p className={`font-bold text-2xl ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ledger feed */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-base tracking-tight">Recent Activity</h2>
                <Link href="/wallet" className="text-xs font-semibold text-[var(--primary)] flex items-center gap-0.5 hover:underline">
                  All <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div
                className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                {activity.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">No recent activity.</div>
                ) : activity.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-4 hover:bg-[var(--muted)] transition-colors ${i < activity.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                  >
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                      a.type === "win" ? "bg-emerald-50" : a.type === "loss" ? "bg-[var(--muted)]" : "bg-[var(--muted)]"
                    }`}>
                      <a.icon className={`h-4 w-4 ${
                        a.type === "win" ? "text-[var(--success)]" : a.type === "loss" ? "text-[var(--danger)]" : "text-[var(--muted-foreground)]"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--foreground)] truncate">{a.label}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{a.time}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${
                      a.type === "win" || a.type === "deposit" ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}>{a.amount}</span>
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
