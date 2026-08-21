"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Shield, Share2, Loader2, Check } from "lucide-react";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { userApi } = await import("@/lib/api");
        setProfile(await userApi.getPublicProfile(id));
      } catch (err: any) {
        setError(err?.message || "This profile could not be found.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: `${profile?.name} on Vouchit`, url });
        return;
      } catch {
        // Share sheet dismissed — fall through to copying instead.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <p className="font-semibold">{error || "Profile not found."}</p>
        <Link href="/explore" className="text-[var(--primary)] underline text-sm">
          Explore wagers
        </Link>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const settled = profile.wins + profile.losses;

  return (
    <div className="flex-1 flex flex-col">
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
        <Link href="/explore">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <h1 className="font-bold text-base flex-1">Profile</h1>
      </div>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6 tracking-tight">
        <div
          className="bg-white border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center gap-4"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <div
              className="h-24 w-24 rounded-full flex items-center justify-center text-white font-bold text-3xl"
              style={{ background: "linear-gradient(135deg,#0d9488,#115e59)" }}
            >
              {getInitials(profile.name)}
            </div>
          )}

          <div className="text-center">
            <h2 className="font-bold text-xl">{profile.name}</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Member since {memberSince}</p>
            {profile.bio && (
              <p className="text-sm text-[var(--muted-foreground)] mt-3 leading-relaxed">{profile.bio}</p>
            )}
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--primary)] border border-[var(--border)] rounded-full px-4 py-1.5 hover:bg-[var(--muted)] transition-colors w-full justify-center"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? "Link copied" : "Share Profile"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Wins", value: profile.wins, icon: Trophy },
            { label: "Losses", value: profile.losses, icon: Shield },
            { label: "Win Rate", value: settled > 0 ? `${profile.winRate}%` : "—", icon: Trophy },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-[var(--border)] rounded-2xl p-4 text-center"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <p className="font-bold text-2xl text-[var(--primary)]">{stat.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {profile.web3Address && (
          <div
            className="bg-white border border-[var(--border)] rounded-2xl p-4"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Verified Wallet
            </p>
            <p className="font-mono text-xs mt-1 break-all">{profile.web3Address}</p>
          </div>
        )}
      </main>
    </div>
  );
}
