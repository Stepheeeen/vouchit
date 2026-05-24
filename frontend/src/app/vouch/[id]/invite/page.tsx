"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, CheckCircle2, Share2, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [wager, setWager] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/vouch/join/${id}`
    : `/vouch/join/${id}`;

  useEffect(() => {
    const load = async () => {
      try {
        const { wagersApi } = await import("@/lib/api");
        const data = await wagersApi.getById(id);
        setWager(data);
      } catch {
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join my Vouchit wager",
        text: wager?.description || "I've created a wager on Vouchit. Join me!",
        url: inviteLink,
      });
    } else {
      handleCopy();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center font-bold uppercase tracking-widest text-[var(--muted-foreground)] text-sm animate-pulse">
          Loading wager...
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto md:py-8 tracking-tight">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full md:bg-[var(--background)] md:border md:border-[var(--border)] overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 md:top-[65px] z-10 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] flex items-center p-4">
          <Link href="/dashboard" className="mr-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Wager Created</h1>
        </header>

        <div className="flex-1 flex flex-col p-6 gap-8 pb-24">

          {/* Success badge */}
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "0 8px 24px rgba(13,148,136,0.35)" }}
            >
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <div className="text-center">
              <h2 className="font-bold text-2xl tracking-tight">Wager Live!</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Your stake is locked in escrow. Share to invite an opponent.</p>
            </div>
          </div>

          {/* Wager summary */}
          {wager && (
            <section className="border border-[var(--border)] p-6 flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">The Wager</p>
              <p className="font-bold text-lg leading-snug uppercase tracking-tighter">{wager.description}</p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Your Stake</p>
                  <p className="font-bold text-xl mt-1">₦{Number(wager.totalPot).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Status</p>
                  <p className="font-bold text-sm mt-1 text-amber-600 uppercase tracking-widest flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Waiting for opponent
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Invite link */}
          <section className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Invite Link</label>
            <div className="flex gap-0 border border-[var(--border)] overflow-hidden">
              <div className="flex-1 px-4 py-3 text-sm font-mono text-[var(--muted-foreground)] bg-[var(--muted)]/30 truncate">
                {inviteLink}
              </div>
              <button
                onClick={handleCopy}
                className="px-4 py-3 bg-[var(--foreground)] text-[var(--background)] flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shrink-0"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
              Share this link with your opponent. They can join directly.
            </p>
          </section>

          {/* Escrow info */}
          <div className="flex items-start gap-3 p-4 border border-[var(--border)] bg-[var(--muted)]/10">
            <Shield className="h-5 w-5 shrink-0 text-[var(--primary)] mt-0.5" />
            <p className="text-xs font-medium text-[var(--muted-foreground)] leading-relaxed">
              Your funds are safely locked in escrow. If no one joins before the wager expires, your full stake will be returned automatically.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)] border-t border-[var(--border)] flex gap-3 justify-center z-20">
          <div className="w-full max-w-2xl flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
            <Button className="flex-1" onClick={() => router.push(`/vouch/${id}`)}>
              View Wager
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
