"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, ChevronRight, 
  ExternalLink, Calendar, Users, Scale, FileText, ArrowLeft, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DisputeStatus = "ALL" | "OPEN" | "RESOLVED";

export default function AdminDisputesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  
  const [filter, setFilter] = useState<DisputeStatus>("ALL");
  const [error, setError] = useState("");
  
  // Resolution actions
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionResult, setResolutionResult] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState<{ id: string; resolution: "WINNER_A" | "WINNER_B" | "REFUND" } | null>(null);

  const loadData = async () => {
    try {
      const { userApi, disputesApi } = await import("@/lib/api");
      const [profile, list] = await Promise.all([
        userApi.getProfile(),
        disputesApi.getAll().catch(() => []),
      ]);
      
      if (profile.role !== "ADMIN") {
        setError("Admin access required.");
      } else {
        setUser(profile);
        setDisputes(list);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin panel data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResolve = async () => {
    if (!showConfirm || isResolving) return;
    const { id, resolution } = showConfirm;
    
    setIsResolving(true);
    setError("");
    try {
      const { disputesApi } = await import("@/lib/api");
      const res = await disputesApi.resolve(id, resolution);
      setResolutionResult(res);
      
      const { toast } = await import("sonner");
      toast.success(res.message || "Dispute resolved successfully!");
      
      // Reload list and close dialog
      await loadData();
      setShowConfirm(null);
      
      // Update selected dispute details if currently open
      if (selectedDispute && selectedDispute.id === id) {
        const updated = listToRender.find(d => d.id === id);
        setSelectedDispute(updated || null);
      }
    } catch (err: any) {
      const { toast } = await import("sonner");
      toast.error(err.message || "Failed to resolve dispute.");
      setError(err.message || "Failed to resolve dispute.");
    } finally {
      setIsResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error && (!user || user.role !== "ADMIN")) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md mx-auto">
        <ShieldAlert className="h-16 w-16 text-[var(--danger)] shrink-0" />
        <h1 className="font-bold text-2xl tracking-tight text-[var(--foreground)]">Access Denied</h1>
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
          You do not have the required permissions to access the moderator dashboard. If you believe this is an error, please contact the administrator.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-2">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const listToRender = disputes.filter((d) => {
    if (filter === "ALL") return true;
    return d.status === filter;
  });

  const getWagerParticipant = (wager: any, side: "CREATOR" | "CHALLENGER") => {
    return wager?.participants?.find((p: any) => p.side === side);
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 md:top-[65px] z-20 bg-white/80 backdrop-blur-md border-b border-[var(--border)] px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard">
          <button className="h-9 w-9 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-[var(--border)] transition-colors">
            <ArrowLeft className="h-5 w-5 text-[var(--foreground)]" />
          </button>
        </Link>
        <div>
          <h1 className="font-bold text-xl tracking-tight flex items-center gap-2">
            <Scale className="h-5 w-5 text-[var(--primary)]" /> Moderator Dashboard
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Inspect evidence and settle disputed wagers.</p>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
        
        {/* Left Side: Disputes list */}
        <section className="flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="font-bold text-base tracking-tight">Active Disputes ({listToRender.length})</h2>
            
            {/* Filter pills */}
            <div className="flex gap-1 bg-[var(--muted)] p-1 rounded-xl">
              {(["ALL", "OPEN", "RESOLVED"] as DisputeStatus[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                    filter === tab 
                      ? "bg-white text-[var(--primary)] shadow-sm"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
            {listToRender.length === 0 ? (
              <div className="py-16 text-center bg-white border border-[var(--border)] rounded-2xl border-dashed flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-[var(--success)] opacity-60" />
                <p className="text-sm font-medium text-[var(--muted-foreground)]">No disputes found matching filter.</p>
              </div>
            ) : (
              listToRender.map((dispute) => {
                const wager = dispute.wager;
                const isSelected = selectedDispute?.id === dispute.id;
                const date = new Date(dispute.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric"
                });
                
                return (
                  <div
                    key={dispute.id}
                    onClick={() => {
                      setSelectedDispute(dispute);
                      setResolutionResult(null);
                      setError("");
                    }}
                    className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md hover:border-[var(--primary)]/50 ${
                      isSelected 
                        ? "border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/30" 
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <p className="font-bold text-sm text-[var(--foreground)] leading-snug line-clamp-1">
                        {wager?.description || "Wager description missing"}
                      </p>
                      <Badge variant={dispute.status === "OPEN" ? "destructive" : "default"}>
                        {dispute.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>Pot: ₦{wager?.totalPot?.toLocaleString() || "0"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Evidence: {dispute.evidence?.length || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{date}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Side: Selected Dispute Details */}
        <section className="w-full lg:w-[450px] bg-white border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-6 self-start shadow-sm min-h-[400px]">
          {selectedDispute ? (
            <div className="flex flex-col gap-6 flex-1">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Dispute Case Details</span>
                  <Badge variant={selectedDispute.status === "OPEN" ? "destructive" : "default"}>{selectedDispute.status}</Badge>
                </div>
                <h3 className="font-bold text-lg leading-snug text-[var(--foreground)]">
                  {selectedDispute.wager?.description}
                </h3>
              </div>

              {/* The stakes */}
              <div className="bg-[var(--muted)]/30 border border-[var(--border)] p-4 rounded-xl flex flex-col gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">The Stakes (Total: ₦{selectedDispute.wager?.totalPot?.toLocaleString()})</p>
                <div className="flex justify-between text-xs font-semibold">
                  <div>
                    <span className="text-[var(--muted-foreground)]">Creator: </span>
                    <span className="text-[var(--foreground)]">{getWagerParticipant(selectedDispute.wager, "CREATOR")?.user?.displayName || "Creator"}</span>
                  </div>
                  <span className="text-[var(--foreground)]">₦{getWagerParticipant(selectedDispute.wager, "CREATOR")?.amount?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <div>
                    <span className="text-[var(--muted-foreground)]">Challenger: </span>
                    <span className="text-[var(--foreground)]">{getWagerParticipant(selectedDispute.wager, "CHALLENGER")?.user?.displayName || "Challenger"}</span>
                  </div>
                  <span className="text-[var(--foreground)]">₦{getWagerParticipant(selectedDispute.wager, "CHALLENGER")?.amount?.toLocaleString() || 0}</span>
                </div>
              </div>

              {/* Claims & Evidence */}
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Submitted Claims & Proof</p>
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {selectedDispute.evidence?.map((ev: any) => (
                    <div key={ev.id} className="border border-[var(--border)] p-4 rounded-xl bg-[var(--muted)]/20 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--foreground)]">
                          {ev.user?.displayName || ev.user?.email || "User"}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted-foreground)] leading-normal italic bg-white p-2.5 rounded-lg border border-[var(--border)]">
                        "{ev.textClaim}"
                      </p>
                      {ev.proofType && (
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider bg-white border border-[var(--border)] w-fit px-2.5 py-1 rounded-md">
                          <span>{ev.proofType}</span>
                          {ev.mediaUrl && (
                            <a 
                              href={ev.mediaUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="inline-flex items-center gap-0.5 underline hover:text-[var(--foreground)] ml-1 cursor-pointer"
                            >
                              Open <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!selectedDispute.evidence || selectedDispute.evidence.length === 0) && (
                    <p className="text-xs text-[var(--muted-foreground)] italic">No claims uploaded yet.</p>
                  )}
                </div>
              </div>

              {/* Resolution options */}
              {selectedDispute.status === "OPEN" ? (
                <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[var(--border)]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">Execute Resolution</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowConfirm({ id: selectedDispute.id, resolution: "WINNER_A" })}
                      className="flex-1 text-xs border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] py-5"
                    >
                      Settle for Creator
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowConfirm({ id: selectedDispute.id, resolution: "WINNER_B" })}
                      className="flex-1 text-xs border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] py-5"
                    >
                      Settle for Challenger
                    </Button>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowConfirm({ id: selectedDispute.id, resolution: "REFUND" })}
                    className="w-full text-xs font-semibold py-5 bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white border-0"
                  >
                    Refund Both Parties
                  </Button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 mt-auto">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">Resolved</p>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      Resolution: <strong>{selectedDispute.resolution}</strong>. The wager funds have been distributed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <Scale className="h-12 w-12 text-[var(--muted-foreground)] opacity-40 shrink-0" />
              <p className="text-sm font-semibold text-[var(--muted-foreground)]">Select a dispute to review case claims, inspect media proof, and settle stakes.</p>
            </div>
          )}
        </section>
      </main>

      {/* Confirmation Dialog Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-[var(--border)] rounded-2xl max-w-md w-full p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-amber-200 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--foreground)]">Confirm Resolution</h3>
                <p className="text-xs text-[var(--muted-foreground)] uppercase font-semibold tracking-wider mt-0.5">
                  Resolution: {showConfirm.resolution}
                </p>
              </div>
            </div>

            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              Are you sure you want to resolve this dispute? This action will execute wallet payouts or refunds immediately and cannot be undone.
            </p>

            <div className="flex gap-3 justify-end pt-2 border-t border-[var(--border)]">
              <Button
                variant="outline"
                disabled={isResolving}
                onClick={() => setShowConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={isResolving}
                onClick={handleResolve}
                className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white border-0 flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs px-5"
                style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)" }}
              >
                {isResolving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Resolving...</>
                ) : (
                  "Confirm & Settle"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
