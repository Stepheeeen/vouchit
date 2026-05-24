"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Crown, Loader2 } from "lucide-react";

const podiumGradients = [
  "from-amber-400 to-yellow-600",
  "from-zinc-300 to-zinc-500",
  "from-amber-600 to-orange-800",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { leaderboardApi, userApi } = await import("@/lib/api");
        const [lb, profile] = await Promise.all([
          leaderboardApi.get(),
          userApi.getProfile().catch(() => null),
        ]);
        setLeaders(lb);
        setCurrentUserId(profile?.id || null);
      } catch {
        setLeaders([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const top3 = leaders.slice(0, 3);
  const rest  = leaders.slice(3);
  const myEntry = leaders.find((l) => l.id === currentUserId);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  // Empty state
  if (leaders.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
          <Link href="/dashboard">
            <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <h1 className="font-bold text-base flex-1">Leaderboard</h1>
          <Trophy className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Trophy className="h-12 w-12 text-[var(--muted-foreground)]" />
          <h2 className="font-bold text-xl">No Rankings Yet</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Be the first to win a wager and claim the top spot!</p>
          <Link href="/vouch/create">
            <button className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)" }}>
              Create a Wager
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Mobile sub-header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
        <Link href="/dashboard">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <h1 className="font-bold text-base flex-1">Leaderboard</h1>
        <Trophy className="h-5 w-5 text-amber-500" />
      </div>

      <main className="flex-1 w-full px-4 md:px-8 lg:px-12 py-6 md:py-8 flex flex-col gap-8">
        {/* Desktop title */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl tracking-tight flex items-center gap-3">
              Leaderboard <Trophy className="h-6 w-6 text-amber-500" />
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Top earners on Vouchit — ranked by wins.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Podium */}
          {top3.length >= 3 && (
            <div className="xl:col-span-2 flex flex-col gap-6">
              <div className="flex items-end justify-center gap-4 pt-4 pb-2">
                {/* 2nd */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${podiumGradients[1]} flex items-center justify-center text-white font-bold text-xl shadow-md`}>
                    {getInitials(top3[1].name)}
                  </div>
                  <p className="font-semibold text-xs text-center truncate w-16">{top3[1].name}</p>
                  <p className="text-xs font-bold text-[var(--muted-foreground)]">₦{(top3[1].totalEarned / 1000).toFixed(0)}k</p>
                  <div className={`h-24 w-20 rounded-t-2xl bg-gradient-to-br ${podiumGradients[1]} flex items-end justify-center pb-2 shadow-md`}>
                    <span className="text-white font-bold text-2xl">2</span>
                  </div>
                </div>
                {/* 1st */}
                <div className="flex flex-col items-center gap-2">
                  <Crown className="h-6 w-6 text-amber-500 mb-1" />
                  <div
                    className={`h-20 w-20 rounded-full bg-gradient-to-br ${podiumGradients[0]} flex items-center justify-center text-white font-bold text-2xl shadow-xl`}
                    style={{ boxShadow: "0 8px 24px rgba(251,191,36,0.4)" }}
                  >
                    {getInitials(top3[0].name)}
                  </div>
                  <p className="font-semibold text-sm text-center truncate w-20">{top3[0].name}</p>
                  <p className="text-sm font-bold text-[var(--primary)]">₦{(top3[0].totalEarned / 1000).toFixed(0)}k</p>
                  <div
                    className={`h-32 w-20 rounded-t-2xl bg-gradient-to-br ${podiumGradients[0]} flex items-end justify-center pb-2`}
                    style={{ boxShadow: "0 8px 24px rgba(251,191,36,0.3)" }}
                  >
                    <span className="text-white font-bold text-3xl">1</span>
                  </div>
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`h-14 w-14 rounded-full bg-gradient-to-br ${podiumGradients[2]} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                    {getInitials(top3[2].name)}
                  </div>
                  <p className="font-semibold text-xs text-center truncate w-16">{top3[2].name}</p>
                  <p className="text-xs font-bold text-[var(--muted-foreground)]">₦{(top3[2].totalEarned / 1000).toFixed(0)}k</p>
                  <div className={`h-16 w-20 rounded-t-2xl bg-gradient-to-br ${podiumGradients[2]} flex items-end justify-center pb-2 shadow-md`}>
                    <span className="text-white font-bold text-2xl">3</span>
                  </div>
                </div>
              </div>

              {/* Your rank card */}
              {myEntry && (
                <div className="rounded-2xl p-5 border-2 border-[var(--primary)] bg-[var(--muted)]" style={{ boxShadow: "0 0 0 4px rgba(13,148,136,0.1)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)] mb-3">Your Ranking</p>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-4xl text-[var(--primary)]">#{myEntry.rank}</span>
                    <div>
                      <p className="font-semibold">{myEntry.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {myEntry.wins} wins · {myEntry.winRate}% rate · ₦{(myEntry.totalEarned / 1000).toFixed(1)}k earned
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${Math.min(100, myEntry.winRate)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full rankings list */}
          <div className={`${top3.length >= 3 ? "xl:col-span-3" : "xl:col-span-5"} flex flex-col gap-3`}>
            <h2 className="font-bold text-base">Full Rankings</h2>
            <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              {leaders.map((p, i) => {
                const isMe = p.id === currentUserId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-4 p-4 transition-colors ${
                      isMe ? "bg-[var(--muted)] border-l-4 border-l-[var(--primary)]" : "hover:bg-[var(--muted)]"
                    } ${i < leaders.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                  >
                    <span className={`w-8 text-center font-bold text-sm ${isMe ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
                      {p.rank <= 3 ? ["🥇", "🥈", "🥉"][p.rank - 1] : `#${p.rank}`}
                    </span>

                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ background: isMe ? "linear-gradient(135deg,#0d9488,#115e59)" : "linear-gradient(135deg,#6b7280,#374151)" }}
                    >
                      {getInitials(p.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? "text-[var(--primary)]" : ""}`}>
                        {p.name}
                        {isMe && <span className="ml-2 text-[10px] bg-[var(--primary)] text-white px-1.5 py-0.5 rounded-full">You</span>}
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">{p.wins} wins · {p.winRate}% win rate</p>
                    </div>

                    <div className="text-right">
                      <span className={`text-sm font-bold ${isMe ? "text-[var(--primary)]" : ""}`}>
                        ₦{(p.totalEarned / 1000).toFixed(1)}k
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
