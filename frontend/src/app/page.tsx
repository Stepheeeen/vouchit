import Link from "next/link";
import { ShieldCheck, Zap, Lock, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans">
      {/* Top Bar for Landing Page */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-white/80 backdrop-blur-md fixed top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)" }}>
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">Vouchit</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            Log in
          </Link>
          <Link href="/auth/login" className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 2px 8px rgba(13,148,136,0.3)" }}>
            Sign up
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 w-full flex flex-col items-center pt-32 pb-20 px-6 overflow-x-hidden">
        
        <div className="max-w-4xl w-full text-center space-y-8 relative">
          {/* Decorative blur behind hero */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--primary)]/10 blur-[100px] rounded-full pointer-events-none" />

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.1] relative z-10">
            The <span className="text-[var(--primary)] relative">trust layer<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 5 Q 50 10, 100 5 T 200 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg></span> for social wagers.
          </h1>
          <p className="text-lg md:text-xl text-[var(--muted-foreground)] max-w-2xl mx-auto relative z-10">
            Funds locked in a secure zero-sum escrow. Settle disputes transparently. Winner gets paid instantly. 
            No more chasing friends for money.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 relative z-10">
            <Link href="/auth/login" className="flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold text-white transition-transform hover:scale-105 active:scale-95" style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 4px 14px rgba(13,148,136,0.4)" }}>
              Start Wagering
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/explore" className="flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold text-[var(--foreground)] border border-[var(--border)] bg-white hover:bg-[var(--muted)] transition-colors">
              Explore Live Bets
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 relative z-10">
          
          <div className="bg-white border border-[var(--border)] rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow group">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Lock className="h-6 w-6 text-[var(--primary)]" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-[var(--foreground)]">Zero-Sum Escrow</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              When you enter a wager, your funds are securely locked in our smart ledger. Neither party can withdraw until the bet is settled.
            </p>
          </div>

          <div className="bg-white border border-[var(--border)] rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow group">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Zap className="h-6 w-6 text-[var(--primary)]" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-[var(--foreground)]">Instant Payouts</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Powered by Paystack integration. The moment a wager is mutually settled, the winner's wallet is credited instantly. No delays.
            </p>
          </div>

          <div className="bg-white border border-[var(--border)] rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow group">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-6 w-6 text-[var(--primary)]" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-[var(--foreground)]">Fair Disputes</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              If a disagreement occurs, both parties can upload evidence to our dispute resolution system for a fair, transparent verdict.
            </p>
          </div>

        </div>

      </main>

      {/* Simple Footer */}
      <footer className="w-full py-8 text-center text-[var(--muted-foreground)] text-sm border-t border-[var(--border)] mt-auto relative z-10 bg-[var(--background)]">
        <p>&copy; {new Date().getFullYear()} Vouchit. All rights reserved.</p>
      </footer>
    </div>
  );
}
