"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function ActiveVouchPage() {
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<"me" | "opponent" | null>(null);

  // Mock data
  const vouch = {
    id: "vch_123",
    description: "Arsenal to beat Chelsea by 2 goals margin",
    status: "ACTIVE", // ACTIVE, PENDING, DISPUTED, SETTLED
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    pot: 10000,
    me: { name: "You", stake: 5000, status: "FUNDED" },
    opponent: { name: "John Doe", stake: 5000, status: "FUNDED" },
  };

  const handleSettle = () => {
    if (!selectedWinner) return;
    // Call API
    setIsSettleModalOpen(false);
    // Show success or navigate
  };

  return (
    <main className="flex-1 flex flex-col bg-[var(--background)] w-full max-w-7xl mx-auto md:py-8">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full bg-[var(--background)] md:bg-[var(--background)] md:rounded-2xl md:shadow-lg md:border md:border-[var(--border)] overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 md:top-[65px] z-10 bg-[var(--background)]/80 md:bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] flex items-center p-4">
        <Link href="/" className="mr-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold leading-tight">Vouch Details</h1>
          <span className="text-xs text-[var(--muted-foreground)]">ID: {vouch.id}</span>
        </div>
        <div className="ml-auto">
          <Badge variant="success" className="shadow-sm">Active</Badge>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4 md:p-8 gap-10 pb-24 tracking-tight">
        
        {/* Description Section */}
        <section className="flex flex-col gap-4 border border-[var(--border)] p-6 md:p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--muted)] blur-3xl -z-10 group-hover:bg-[var(--foreground)] transition-colors opacity-10"></div>
          <p className="text-xl md:text-2xl font-bold leading-tight uppercase tracking-tighter">
            {vouch.description}
          </p>
          <div className="flex items-center gap-2 mt-2 w-fit">
            <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Expires in 23h 45m</span>
          </div>
        </section>

        {/* Pot & Stakes */}
        <section className="flex flex-col gap-6">
          <div className="flex justify-between items-end border-b border-[var(--border)] pb-2">
            <h2 className="text-sm md:text-base font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">The Stakes</h2>
          </div>
          
          <div className="flex justify-between items-center bg-[var(--muted)]/20 border border-[var(--border)] p-6 md:p-8">
            <div className="flex flex-col items-start gap-1 w-1/3">
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">You</span>
              <span className="font-bold text-2xl md:text-3xl">₦5k</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--background)] bg-[var(--foreground)] px-2 py-0.5 mt-1">Funded</span>
            </div>
            
            <div className="flex flex-col items-center justify-center w-1/3 border-x border-[var(--border)]">
              <span className="text-[10px] md:text-xs uppercase font-semibold text-[var(--muted-foreground)] tracking-widest mb-2">Total Pot</span>
              <span className="text-4xl md:text-5xl font-bold text-[var(--foreground)]">₦10k</span>
            </div>
            
            <div className="flex flex-col items-end gap-1 w-1/3">
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">John D.</span>
              <span className="font-bold text-2xl md:text-3xl">₦5k</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--background)] bg-[var(--foreground)] px-2 py-0.5 mt-1">Funded</span>
            </div>
          </div>
        </section>

        {/* Info Box */}
        <div className="border border-[var(--border)] p-5 flex gap-4 text-sm text-[var(--muted-foreground)] bg-transparent">
          <InfoIcon className="h-5 w-5 shrink-0 text-[var(--foreground)]" />
          <p className="font-medium leading-relaxed">
            Funds are locked in escrow. Once the event is over, both parties must agree on the winner. If there's a disagreement, you can open a dispute.
          </p>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)] border-t border-[var(--border)] flex gap-3 justify-center z-20">
        <div className="w-full max-w-2xl flex gap-3">
          <Button 
            variant="outline"
            className="flex-1"
            onClick={() => setIsDisputeModalOpen(true)}
          >
            DISPUTE
          </Button>
          <Button 
            className="flex-2 w-2/3"
            onClick={() => setIsSettleModalOpen(true)}
          >
            DECLARE WINNER
          </Button>
        </div>
      </div>

      {/* Settlement Modal */}
      <Dialog open={isSettleModalOpen} onOpenChange={setIsSettleModalOpen}>
        <DialogContent className="sm:max-w-md border-[var(--border)] rounded-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase tracking-tighter">Declare Winner</DialogTitle>
            <DialogDescription className="text-xs font-semibold uppercase tracking-widest mt-2">
              Who won this wager? Both parties must agree.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-6">
            <button
              onClick={() => setSelectedWinner("me")}
              className={`flex items-center justify-between p-6 border transition-all ${selectedWinner === "me" ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] hover:border-[var(--foreground)]/50"}`}
            >
              <div className="flex flex-col items-start">
                <span className="font-bold text-xl uppercase tracking-tighter">I Won</span>
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${selectedWinner === "me" ? "text-[var(--background)]" : "text-[var(--muted-foreground)]"}`}>Claim the ₦10,000 pot</span>
              </div>
              {selectedWinner === "me" && <CheckCircle2 className="h-6 w-6 text-[var(--background)]" />}
            </button>
            <button
              onClick={() => setSelectedWinner("opponent")}
              className={`flex items-center justify-between p-6 border transition-all ${selectedWinner === "opponent" ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] hover:border-[var(--foreground)]/50"}`}
            >
              <div className="flex flex-col items-start">
                <span className="font-bold text-xl uppercase tracking-tighter">John Doe Won</span>
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${selectedWinner === "opponent" ? "text-[var(--background)]" : "text-[var(--muted-foreground)]"}`}>Concede the wager</span>
              </div>
              {selectedWinner === "opponent" && <CheckCircle2 className="h-6 w-6 text-[var(--background)]" />}
            </button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button 
              type="button" 
              className="w-full" 
              disabled={!selectedWinner}
              onClick={handleSettle}
            >
              Confirm & Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </main>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
