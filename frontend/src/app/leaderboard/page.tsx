"use client";

import Link from "next/link";
import { ArrowLeft, Trophy, TrendingUp, Crown } from "lucide-react";

const LEADERS = [
  { rank: 1,  name: "Emeka O.",  wins: 24, amount: "₦380k", rate: "92%", initials: "EO" },
  { rank: 2,  name: "Tunde A.",  wins: 19, amount: "₦240k", rate: "86%", initials: "TA" },
  { rank: 3,  name: "Bisi F.",   wins: 17, amount: "₦210k", rate: "81%", initials: "BF" },
  { rank: 4,  name: "Zara M.",   wins: 15, amount: "₦185k", rate: "79%", initials: "ZM" },
  { rank: 5,  name: "Ade K.",    wins: 12, amount: "₦148k", rate: "75%", initials: "AK" },
  { rank: 6,  name: "John D.",   wins: 12, amount: "₦48.5k", rate: "80%", initials: "JD", isMe: true },
  { rank: 7,  name: "Kola S.",   wins: 10, amount: "₦120k", rate: "71%", initials: "KS" },
  { rank: 8,  name: "Nkechi T.", wins: 9,  amount: "₦105k", rate: "69%", initials: "NT" },
  { rank: 9,  name: "Femi A.",   wins: 8,  amount: "₦98k",  rate: "67%", initials: "FA" },
  { rank: 10, name: "Sola B.",   wins: 7,  amount: "₦82k",  rate: "64%", initials: "SB" },
];

const podiumGradients = [
  "from-amber-400 to-yellow-600",
  "from-zinc-300 to-zinc-500",
  "from-amber-600 to-orange-800",
];

export default function LeaderboardPage() {
  const top3 = LEADERS.slice(0, 3);
  const rest  = LEADERS.slice(3);

  return (
    <div className="flex-1 flex flex-col">
      {/* Mobile sub-header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
        <Link href="/">
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
            <p className="text-sm text-[var(--muted-foreground)] mt-1">This week's top earners on Vouchit.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Podium — 2 cols on xl */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="flex items-end justify-center gap-4 pt-4 pb-2">
              {/* 2nd */}
              <div className="flex flex-col items-center gap-2">
                <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${podiumGradients[1]} flex items-center justify-center text-white font-bold text-xl shadow-md`}>{top3[1].initials}</div>
                <p className="font-semibold text-xs text-center">{top3[1].name}</p>
                <p className="text-xs font-bold text-[var(--muted-foreground)]">{top3[1].amount}</p>
                <div className={`h-24 w-20 rounded-t-2xl bg-gradient-to-br ${podiumGradients[1]} flex items-end justify-center pb-2 shadow-md`}>
                  <span className="text-white font-bold text-2xl">2</span>
                </div>
              </div>

              {/* 1st */}
              <div className="flex flex-col items-center gap-2">
                <Crown className="h-6 w-6 text-amber-500 mb-1" />
                <div className={`h-20 w-20 rounded-full bg-gradient-to-br ${podiumGradients[0]} flex items-center justify-center text-white font-bold text-2xl shadow-xl`} style={{ boxShadow: "0 8px 24px rgba(251,191,36,0.4)" }}>{top3[0].initials}</div>
                <p className="font-semibold text-sm text-center">{top3[0].name}</p>
                <p className="text-sm font-bold text-[var(--primary)]">{top3[0].amount}</p>
                <div className={`h-32 w-20 rounded-t-2xl bg-gradient-to-br ${podiumGradients[0]} flex items-end justify-center pb-2`} style={{ boxShadow: "0 8px 24px rgba(251,191,36,0.3)" }}>
                  <span className="text-white font-bold text-3xl">1</span>
                </div>
              </div>

              {/* 3rd */}
              <div className="flex flex-col items-center gap-2">
                <div className={`h-14 w-14 rounded-full bg-gradient-to-br ${podiumGradients[2]} flex items-center justify-center text-white font-bold text-lg shadow-md`}>{top3[2].initials}</div>
                <p className="font-semibold text-xs text-center">{top3[2].name}</p>
                <p className="text-xs font-bold text-[var(--muted-foreground)]">{top3[2].amount}</p>
                <div className={`h-16 w-20 rounded-t-2xl bg-gradient-to-br ${podiumGradients[2]} flex items-end justify-center pb-2 shadow-md`}>
                  <span className="text-white font-bold text-2xl">3</span>
                </div>
              </div>
            </div>

            {/* Your rank */}
            <div
              className="rounded-2xl p-5 border-2 border-[var(--primary)] bg-[var(--muted)]"
              style={{ boxShadow: "0 0 0 4px rgba(13,148,136,0.1)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)] mb-3">Your Ranking</p>
              <div className="flex items-center gap-4">
                <span className="font-bold text-4xl text-[var(--primary)]">#6</span>
                <div>
                  <p className="font-semibold">John Doe</p>
                  <p className="text-xs text-[var(--muted-foreground)]">12 wins · 80% rate · ₦48.5k earned</p>
                </div>
              </div>
              <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
                <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: "60%" }} />
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-1.5 font-medium">3 more wins to reach #5</p>
            </div>
          </div>

          {/* Rankings list — 3 cols on xl */}
          <div className="xl:col-span-3 flex flex-col gap-3">
            <h2 className="font-bold text-base">Full Rankings</h2>
            <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              {LEADERS.map((p, i) => (
                <div
                  key={p.rank}
                  className={`flex items-center gap-4 p-4 transition-colors ${
                    p.isMe ? "bg-[var(--muted)] border-l-4 border-l-[var(--primary)]" : "hover:bg-[var(--muted)]"
                  } ${i < LEADERS.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                >
                  <span className={`w-8 text-center font-bold text-sm ${p.isMe ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
                    {p.rank <= 3 ? ["🥇","🥈","🥉"][p.rank - 1] : `#${p.rank}`}
                  </span>

                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: p.isMe ? "linear-gradient(135deg,#0d9488,#115e59)" : "linear-gradient(135deg,#6b7280,#374151)" }}
                  >
                    {p.initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${p.isMe ? "text-[var(--primary)]" : ""}`}>
                      {p.name}{p.isMe && <span className="ml-2 text-[10px] bg-[var(--primary)] text-white px-1.5 py-0.5 rounded-full">You</span>}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">{p.wins} wins · {p.rate} win rate</p>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-bold ${p.isMe ? "text-[var(--primary)]" : ""}`}>{p.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
