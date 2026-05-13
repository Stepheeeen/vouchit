"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreateVouchPage() {
  const router = useRouter();
  
  const [description, setDescription] = useState("");
  const [stake, setStake] = useState("");
  const [isSymmetric, setIsSymmetric] = useState(true);
  const [expiryDays, setExpiryDays] = useState("1");
  const [isLoading, setIsLoading] = useState(false);

  // Simple validation
  const isStakeValid = !isNaN(Number(stake)) && Number(stake) >= 500;
  const isDescValid = description.length >= 10 && description.length <= 280;
  const isValid = isStakeValid && isDescValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsLoading(true);
    // Mock API call to create vouch
    setTimeout(() => {
      setIsLoading(false);
      router.push("/vouch/vch_new_123/invite");
    }, 1000);
  };

  return (
    <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto md:py-8 tracking-tight">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full md:bg-[var(--background)] md:border md:border-[var(--border)] overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 md:top-[65px] z-10 bg-[var(--background)]/90 md:bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] flex items-center p-4">
        <Link href="/" className="mr-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Create Vouch</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-8 pb-24">
        
        {/* Description Section */}
        <section className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">The Wager</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Arsenal will win the Premier League this season"
            className="w-full min-h-[120px] resize-none border border-[var(--border)] bg-transparent px-4 py-4 text-base focus-visible:outline-none focus-visible:border-[var(--foreground)] transition-colors"
            maxLength={280}
          />
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-1">
            <span>Be verifiable and clear.</span>
            <span className={description.length > 280 ? "text-[var(--danger)]" : ""}>
              {description.length}/280
            </span>
          </div>
        </section>

        {/* Stake Section */}
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Your Stake</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-xl text-[var(--muted-foreground)]">₦</span>
              <Input 
                type="number" 
                inputMode="numeric"
                placeholder="5000"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="pl-10 text-2xl font-bold h-16 rounded-none focus-visible:ring-0 focus-visible:border-[var(--foreground)]"
              />
            </div>
            {stake && !isStakeValid && (
              <span className="text-xs font-semibold text-[var(--danger)]">Minimum stake is ₦500.</span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Wager Type</label>
            <div className="grid grid-cols-2 gap-0 border border-[var(--border)]">
              <div 
                onClick={() => setIsSymmetric(true)}
                className={`p-4 cursor-pointer transition-colors border-r border-[var(--border)] ${isSymmetric ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-transparent hover:bg-[var(--muted)]/50'}`}
              >
                <div className="font-semibold uppercase tracking-widest text-xs">Symmetric</div>
                <div className={`text-[10px] mt-2 font-medium leading-tight ${isSymmetric ? 'text-[var(--background)]/80' : 'text-[var(--muted-foreground)]'}`}>Opponent matches your stake exactly.</div>
              </div>
              <div 
                onClick={() => setIsSymmetric(false)}
                className={`p-4 cursor-pointer transition-colors ${!isSymmetric ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-transparent hover:bg-[var(--muted)]/50'}`}
              >
                <div className="font-semibold uppercase tracking-widest text-xs">Custom</div>
                <div className={`text-[10px] mt-2 font-medium leading-tight ${!isSymmetric ? 'text-[var(--background)]/80' : 'text-[var(--muted-foreground)]'}`}>Opponent can set a different stake.</div>
              </div>
            </div>
          </div>
        </section>

        {/* Expiry Section */}
        <section className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Expiry</label>
          <select 
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            className="flex h-16 w-full border border-[var(--border)] bg-transparent px-4 text-base font-semibold uppercase tracking-widest focus-visible:outline-none focus-visible:border-[var(--foreground)] appearance-none rounded-none"
          >
            <option value="1">24 Hours</option>
            <option value="3">3 Days</option>
            <option value="7">1 Week</option>
            <option value="30">1 Month</option>
          </select>
        </section>

        {/* Summary Card */}
        {isValid && (
          <section className="border border-[var(--foreground)] p-6 flex flex-col gap-4 mt-4 bg-[var(--muted)]/10 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between text-[var(--foreground)] font-semibold text-xs uppercase tracking-widest border-b border-[var(--border)] pb-2">
              <span className="flex items-center gap-2"><Info className="h-4 w-4" /> Summary</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Total Pot (Est.)</span>
              <span className="font-bold text-2xl">₦{isSymmetric ? Number(stake) * 2 : Number(stake)} {isSymmetric ? '' : '+ ?'}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">Fee (2.5%)</span>
              <span className="font-semibold text-sm">₦{isSymmetric ? (Number(stake) * 2 * 0.025) : '...'}</span>
            </div>
            <div className="text-[10px] font-semibold text-[var(--muted-foreground)] leading-tight pt-4 mt-2 border-t border-[var(--border)]">
              FUNDS ARE LOCKED IN ESCROW IMMEDIATELY. REFUNDED IF NO ONE JOINS.
            </div>
          </section>
        )}

      </form>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--background)] border-t border-[var(--border)] flex justify-center z-20">
        <div className="w-full max-w-2xl">
          <Button 
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="w-full"
          >
            {isLoading ? "CREATING..." : "PROCEED TO PAYMENT"}
            {!isLoading && <ArrowRight className="ml-3 h-5 w-5" />}
          </Button>
        </div>
      </div>
      </div>
    </main>
  );
}
