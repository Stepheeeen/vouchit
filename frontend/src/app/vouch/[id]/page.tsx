"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const STATUS_BADGE: Record<string, { label: string; variant: any }> = {
  ACTIVE:          { label: "Active",    variant: "success"  },
  PENDING_FUNDING: { label: "Waiting",   variant: "warning"  },
  SETTLED:         { label: "Settled",   variant: "default"  },
  DISPUTED:        { label: "Disputed",  variant: "destructive" },
  EXPIRED:         { label: "Expired",   variant: "secondary" },
};

export default function ActiveVouchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [wager, setWager]           = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [dispute, setDispute]       = useState<any>(null);

  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settleResult, setSettleResult] = useState<any>(null);
  const [settleError, setSettleError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { wagersApi, userApi, disputesApi } = await import("@/lib/api");
        const [wagerData, profileData] = await Promise.all([
          wagersApi.getById(id),
          userApi.getProfile().catch(() => null),
        ]);
        setWager(wagerData);
        setCurrentUser(profileData);
        if (wagerData.status === "DISPUTED") {
          const disputeData = await disputesApi.getByWagerId(id).catch(() => null);
          setDispute(disputeData);
        }
      } catch {
        setError("Could not load wager.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSettle = async () => {
    if (!selectedWinner || isSettling) return;
    setSettleError("");
    setIsSettling(true);
    try {
      const { wagersApi } = await import("@/lib/api");
      const result = await wagersApi.settle(id, selectedWinner);
      setSettleResult(result);
      setIsSettleOpen(false);
      
      const { toast } = await import("sonner");
      if (result.status === "SETTLED") {
        toast.success(result.message || "Wager settled successfully!");
      } else if (result.status === "DISPUTED") {
        toast.warning("Disagreement recorded. Dispute opened automatically.");
      } else {
        toast.info(result.message || "Vote recorded successfully!");
      }

      // Refresh wager
      const { wagersApi: wa, disputesApi: da } = await import("@/lib/api");
      const updatedWager = await wa.getById(id);
      setWager(updatedWager);
      if (updatedWager.status === "DISPUTED") {
        setDispute(await da.getByWagerId(id).catch(() => null));
      }
    } catch (err: any) {
      setSettleError(err.message || "Failed to submit settlement vote.");
      const { toast } = await import("sonner");
      toast.error(err.message || "Failed to submit settlement vote.");
    } finally {
      setIsSettling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error || !wager) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-[var(--danger)]" />
        <h2 className="font-bold text-xl">Wager Not Found</h2>
        <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
        <Link href="/dashboard"><Button>Go to Dashboard</Button></Link>
      </div>
    );
  }

  const myParticipant    = wager.participants?.find((p: any) => p.userId === currentUser?.id);
  const otherParticipant = wager.participants?.find((p: any) => p.userId !== currentUser?.id);
  const statusInfo = STATUS_BADGE[wager.status] || { label: wager.status, variant: "default" };
  const canSettle = wager.status === "ACTIVE" && myParticipant && wager.participants?.length >= 2;
  const canDispute = wager.status === "ACTIVE" && myParticipant;
  const isWinner = wager.winnerId && wager.winnerId === currentUser?.id;
  const isLoser  = wager.winnerId && wager.winnerId !== currentUser?.id;
  const expiresMs = new Date(wager.expiresAt).getTime() - Date.now();
  const expiresLabel = expiresMs > 0
    ? `${Math.round(expiresMs / 3600000)}h remaining`
    : "Expired";

  const otherName = otherParticipant?.user?.displayName
    || otherParticipant?.user?.email?.split("@")[0]
    || "Opponent";

  return (
    <main className="flex-1 flex flex-col bg-[var(--background)] w-full max-w-7xl mx-auto md:py-8">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full bg-[var(--background)] md:rounded-2xl md:shadow-lg md:border md:border-[var(--border)] overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 md:top-[65px] z-10 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] flex items-center p-4">
          <Link href="/dashboard" className="mr-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold leading-tight">Vouch Details</h1>
            <span className="text-xs text-[var(--muted-foreground)]">ID: {wager.id.slice(0, 16)}…</span>
          </div>
          <div className="ml-auto">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-4 md:p-8 gap-8 pb-24 tracking-tight">

          {/* Settlement result banner */}
          {settleResult && (
            <div className={`flex items-start gap-3 p-4 border rounded-xl text-sm font-semibold ${
              settleResult.status === "SETTLED"
                ? "border-[var(--success)]/30 bg-emerald-50 text-emerald-700"
                : settleResult.status === "DISPUTED"
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-[var(--primary)]/30 bg-teal-50 text-teal-700"
            }`}>
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              {settleResult.message || (settleResult.status === "SETTLED" ? "Wager settled!" : "Vote recorded.")}
            </div>
          )}

          {/* Win/loss banner */}
          {isWinner && (
            <div className="flex items-center gap-3 p-4 border border-[var(--success)]/30 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl">
              <CheckCircle2 className="h-5 w-5 shrink-0" /> 🎉 You won this wager! Funds have been credited to your wallet.
            </div>
          )}
          {isLoser && (
            <div className="flex items-center gap-3 p-4 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-sm font-semibold rounded-xl">
              <AlertCircle className="h-5 w-5 shrink-0" /> You lost this wager.
            </div>
          )}

          {/* Description */}
          <section className="flex flex-col gap-4 border border-[var(--border)] p-6 md:p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--muted)] blur-3xl -z-10 opacity-10" />
            <p className="text-xl md:text-2xl font-bold leading-tight uppercase tracking-tighter">
              {wager.description}
            </p>
            <div className="flex items-center gap-2 mt-2 w-fit">
              <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                {expiresLabel}
              </span>
            </div>
          </section>

          {/* Stakes */}
          <section className="flex flex-col gap-6">
            <div className="flex justify-between items-end border-b border-[var(--border)] pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">The Stakes</h2>
            </div>
            <div className="flex justify-between items-center bg-[var(--muted)]/20 border border-[var(--border)] p-6 md:p-8">
              {/* Me */}
              <div className="flex flex-col items-start gap-1 w-1/3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {myParticipant ? "You" : "Creator"}
                </span>
                <span className="font-bold text-2xl md:text-3xl">
                  ₦{Number(myParticipant?.amount || wager.participants?.[0]?.amount || 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--background)] bg-[var(--foreground)] px-2 py-0.5 mt-1">
                  {myParticipant?.status || "Pending"}
                </span>
              </div>

              {/* Pot */}
              <div className="flex flex-col items-center justify-center w-1/3 border-x border-[var(--border)]">
                <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] tracking-widest mb-2">Total Pot</span>
                <span className="text-4xl md:text-5xl font-bold text-[var(--foreground)]">
                  ₦{(Number(wager.totalPot) / 1000).toFixed(0)}k
                </span>
              </div>

              {/* Opponent */}
              <div className="flex flex-col items-end gap-1 w-1/3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {otherParticipant ? otherName : "Waiting…"}
                </span>
                <span className="font-bold text-2xl md:text-3xl">
                  {otherParticipant ? `₦${Number(otherParticipant.amount).toLocaleString()}` : "—"}
                </span>
                {otherParticipant && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--background)] bg-[var(--foreground)] px-2 py-0.5 mt-1">
                    {otherParticipant.status}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* No opponent yet — invite */}
          {wager.status === "PENDING_FUNDING" && myParticipant && (
            <div className="border border-amber-200 bg-amber-50 p-4 flex flex-col gap-2">
              <p className="text-sm font-semibold text-amber-800">Waiting for an opponent</p>
              <p className="text-xs text-amber-700">No one has joined yet. Share the link below to invite someone.</p>
              <Link href={`/vouch/${id}/invite`}>
                <Button variant="outline" size="sm" className="mt-1 w-fit">View Invite Link</Button>
              </Link>
            </div>
          )}

          {/* Disputed banner */}
          {wager.status === "DISPUTED" && myParticipant && (
            <div className="border border-red-200 bg-red-50 p-4 flex flex-col gap-2">
              <p className="text-sm font-semibold text-red-800">Wager in Dispute</p>
              <p className="text-xs text-red-700">
                A disagreement was recorded for this wager. You can upload files, screenshots, or web links to support your claim.
              </p>
              <Link href={`/vouch/${id}/dispute`}>
                <Button variant="destructive" size="sm" className="mt-1 w-fit bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white border-0">
                  Upload Evidence
                </Button>
              </Link>
            </div>
          )}

          {/* Dispute evidence section */}
          {wager.status === "DISPUTED" && dispute && (
            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-end border-b border-[var(--border)] pb-2">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Dispute Evidence</h2>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                  Under Review
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {dispute.evidence?.map((ev: any) => (
                  <div key={ev.id} className="border border-[var(--border)] p-4 bg-white rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--foreground)]">
                        {ev.user?.displayName || ev.user?.email || "User"}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)] leading-normal italic">
                      "{ev.textClaim}"
                    </p>
                    {ev.proofType && (
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold text-[var(--primary)] uppercase tracking-wider bg-[var(--muted)] w-fit px-2 py-1 rounded">
                        <span>Proof ({ev.proofType})</span>
                        {ev.mediaUrl && (
                          <a href={ev.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--foreground)] ml-1">
                            View Link
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!dispute.evidence || dispute.evidence.length === 0) && (
                  <p className="text-xs text-[var(--muted-foreground)] italic">No evidence has been uploaded yet.</p>
                )}
              </div>
            </section>
          )}

          {/* Info */}
          <div className="border border-[var(--border)] p-5 flex gap-4 text-sm text-[var(--muted-foreground)]">
            <svg className="h-5 w-5 shrink-0 text-[var(--foreground)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
            <p className="font-medium leading-relaxed">
              Funds are locked in escrow. Once the event ends, both parties declare the winner. If you disagree, open a dispute.
            </p>
          </div>
        </div>

        {/* Floating Actions */}
        {canSettle && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)] border-t border-[var(--border)] flex gap-3 justify-center z-20">
            <div className="w-full max-w-2xl flex gap-3">
              {canDispute && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push(`/vouch/${id}/dispute`)}
                >
                  DISPUTE
                </Button>
              )}
              <Button className="flex-2 w-2/3" onClick={() => setIsSettleOpen(true)}>
                DECLARE WINNER
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Settlement Modal */}
      <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
        <DialogContent className="sm:max-w-md border-[var(--border)] rounded-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tighter">Declare Winner</DialogTitle>
            <DialogDescription className="text-xs font-semibold uppercase tracking-widest mt-2">
              Who won this wager? Both parties must agree.
            </DialogDescription>
          </DialogHeader>

          {settleError && (
            <div className="flex items-center gap-2 p-3 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-xs font-semibold rounded">
              <AlertCircle className="h-4 w-4 shrink-0" /> {settleError}
            </div>
          )}

          <div className="flex flex-col gap-4 py-4">
            {/* I won */}
            {currentUser && (
              <button
                onClick={() => setSelectedWinner(currentUser.id)}
                className={`flex items-center justify-between p-6 border transition-all ${
                  selectedWinner === currentUser.id
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] hover:border-[var(--foreground)]/50"
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className="font-bold text-xl uppercase tracking-tighter">I Won</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${selectedWinner === currentUser.id ? "text-[var(--background)]" : "text-[var(--muted-foreground)]"}`}>
                    Claim ₦{(Number(wager.totalPot) * 0.975).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {selectedWinner === currentUser.id && <CheckCircle2 className="h-6 w-6" />}
              </button>
            )}

            {/* Opponent won */}
            {otherParticipant && (
              <button
                onClick={() => setSelectedWinner(otherParticipant.userId)}
                className={`flex items-center justify-between p-6 border transition-all ${
                  selectedWinner === otherParticipant.userId
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] hover:border-[var(--foreground)]/50"
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className="font-bold text-xl uppercase tracking-tighter">{otherName} Won</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${selectedWinner === otherParticipant.userId ? "text-[var(--background)]" : "text-[var(--muted-foreground)]"}`}>
                    Concede the wager
                  </span>
                </div>
                {selectedWinner === otherParticipant.userId && <CheckCircle2 className="h-6 w-6" />}
              </button>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="w-full"
              disabled={!selectedWinner || isSettling}
              onClick={handleSettle}
            >
              {isSettling ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</span>
              ) : "Confirm & Sign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
