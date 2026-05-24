"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, ChevronRight, Clock, Search, Loader2 } from "lucide-react";

const CATEGORIES = ["All", "Sports", "Crypto", "Lifestyle", "Entertainment", "Finance", "Other"];

const categoryColor: Record<string, string> = {
  Sports:        "bg-blue-100 text-blue-700 border-blue-200",
  Crypto:        "bg-amber-100 text-amber-700 border-amber-200",
  Lifestyle:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  Entertainment: "bg-purple-100 text-purple-700 border-purple-200",
  Finance:       "bg-teal-100 text-teal-700 border-teal-200",
  Other:         "bg-gray-100 text-gray-600 border-gray-200",
};

// Simple heuristic to assign a category based on description keywords
function guessCategory(description: string): string {
  const lower = description.toLowerCase();
  if (/btc|bitcoin|crypto|eth|coin|token|nft|web3/i.test(lower)) return "Crypto";
  if (/league|cup|goal|match|team|score|win|arsenal|chelsea|premier|nba|nfl|sport|football|basketball|tennis|cricket|afcon|world cup/i.test(lower)) return "Sports";
  if (/naira|rate|economy|inflation|gdp|forex|dollar|market|stock|invest/i.test(lower)) return "Finance";
  if (/kg|diet|gym|fitness|run|marathon|weight|health|exercise/i.test(lower)) return "Lifestyle";
  if (/album|song|movie|show|netflix|davido|wizkid|burna|music|release/i.test(lower)) return "Entertainment";
  return "Other";
}

export default function ExplorePage() {
  const [wagers, setWagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat]       = useState("All");
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { wagersApi, userApi } = await import("@/lib/api");
        const [data, profile] = await Promise.all([
          wagersApi.getAll(),
          userApi.getProfile().catch(() => null)
        ]);
        setWagers(data);
        setCurrentUser(profile);
      } catch {
        setWagers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const enriched = wagers.map((w) => ({
    ...w,
    category: guessCategory(w.description),
    creatorName: w.creator?.displayName || w.creator?.email?.split("@")[0] || "Unknown",
    initials: (w.creator?.displayName || w.creator?.email || "?").charAt(0).toUpperCase(),
  }));

  const filtered = enriched.filter((w) =>
    (cat === "All" || w.category === cat) &&
    (!search || w.description.toLowerCase().includes(search.toLowerCase()))
  );

  const trending = enriched.sort((a, b) => Number(b.totalPot) - Number(a.totalPot))[0];

  return (
    <div className="flex-1 flex flex-col">
      {/* Mobile sub-header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
        <Link href="/dashboard">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <h1 className="font-bold text-base flex-1">Explore</h1>
        <Flame className="h-5 w-5 text-[var(--primary)]" />
      </div>

      <main className="flex-1 w-full px-4 md:px-8 lg:px-12 py-6 md:py-8 flex flex-col gap-8">
        {/* Desktop title */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl tracking-tight flex items-center gap-3">
              Explore <Flame className="h-6 w-6 text-[var(--primary)]" />
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Browse and join live public wagers.</p>
          </div>
        </div>

        {/* Trending Hero */}
        {trending && (
          <div
            className="rounded-2xl p-6 md:p-8 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "var(--shadow-md)" }}
          >
            <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-12 -right-4 h-28 w-28 rounded-full bg-white/5" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70 mb-2 flex items-center gap-1">
                  <Flame className="h-3 w-3" /> Highest Pot Right Now
                </p>
                <p className="font-bold text-white text-xl md:text-2xl leading-snug max-w-lg">
                  &quot;{trending.description}&quot;
                </p>
                <p className="text-white/60 text-sm mt-2 font-medium">
                  by {trending.creatorName} · {trending.participants?.length || 1} participant{trending.participants?.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-3">
                <div>
                  <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">Total Pot</p>
                  <p className="text-white font-bold text-3xl">₦{(Number(trending.totalPot) / 1000).toFixed(0)}k</p>
                </div>
                <Link href={`/vouch/join/${trending.id}`}>
                  <button className="bg-white text-[var(--primary)] text-xs font-bold uppercase tracking-widest px-5 py-3 rounded-xl hover:bg-[var(--muted)] transition-colors flex items-center gap-2 shadow-sm">
                    Join Wager <ChevronRight className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search wagers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  cat === c
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                    : "bg-white text-[var(--muted-foreground)] border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Wager grid */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <Flame className="h-12 w-12 text-[var(--muted-foreground)]" />
            <h3 className="font-bold text-lg">No wagers found</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              {wagers.length === 0 ? "No live wagers right now. Be the first to create one!" : "Try a different filter or search term."}
            </p>
            <Link href="/vouch/create">
              <button className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)" }}>
                Create a Wager
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((w) => {
              const isCreator = currentUser && w.creatorId === currentUser.id;
              const isAlreadyJoined = w.participants?.some((p: any) => p.userId === currentUser?.id);
              const isJoinable = w.status === "PENDING_FUNDING" && !isCreator && !isAlreadyJoined;
              const wagerUrl = isJoinable ? `/vouch/join/${w.id}` : `/vouch/${w.id}`;
              return (
                <Link key={w.id} href={wagerUrl}>
                  <div
                    className="group bg-white border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--primary)] hover:shadow-md transition-all h-full flex flex-col justify-between gap-4"
                    style={{ boxShadow: "var(--shadow-sm)" }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <p className="font-semibold text-sm leading-snug flex-1 text-[var(--foreground)] line-clamp-2">{w.description}</p>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${categoryColor[w.category] || categoryColor["Other"]}`}>
                        {w.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-[10px]"
                          style={{ background: "linear-gradient(135deg,#0d9488,#115e59)" }}
                        >
                          {w.initials}
                        </div>
                        <span className="text-xs text-[var(--muted-foreground)] font-semibold">{w.creatorName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                          <Clock className="h-3 w-3" />
                          {Math.max(0, Math.round((new Date(w.expiresAt).getTime() - Date.now()) / 3600000))}h left
                        </div>
                        <span className="font-bold text-base text-[var(--primary)]">
                          ₦{(Number(w.totalPot) / 1000).toFixed(0)}k
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
