import Link from "next/link";
import { ShieldCheck, Zap, Lock, ArrowRight, KeyRound } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans">
      {/* Top Bar for Landing Page */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-white/80 backdrop-blur-md fixed top-0 z-50">
        <Link href="/" className="flex items-center">
          <img src="/logo-full-colored.png" alt="Vouchit Logo" className="h-9 w-auto object-contain" />
        </Link>
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
          {/* The old copy described a product that no longer exists: a
              custodial naira app with a Vouchit-held balance. It never
              mentioned crypto, Base, or needing a wallet, so nobody arriving
              here knew what they were signing up for. */}
          <p className="text-lg md:text-xl text-[var(--muted-foreground)] max-w-2xl mx-auto relative z-10">
            Settle bets with friends in crypto, without either of you holding the money.
            Both stakes go into a smart contract on Base. Agree on the winner and it pays
            out on its own. No more chasing anyone for what they owe.
          </p>
          <p className="text-sm text-[var(--muted-foreground)]/80 max-w-xl mx-auto relative z-10">
            Stakes are in ETH or USDC on Base. You sign in with a passkey — no browser
            extension, no seed phrase. Vouchit takes 2.5% of the pot when a wager settles.
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
            <h3 className="text-xl font-bold mb-3 text-[var(--foreground)]">Non-custodial escrow</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Both stakes sit in the VouchitEscrow contract on Base, not in a Vouchit account.
              We never hold your money and cannot move it. Neither can your opponent.
            </p>
          </div>

          <div className="bg-white border border-[var(--border)] rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow group">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Zap className="h-6 w-6 text-[var(--primary)]" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-[var(--foreground)]">Paid out on-chain</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              When you both vote for the same winner, the contract releases the pot to their
              wallet in that same transaction, less a 2.5% fee. No withdrawal request, no
              waiting on us.
            </p>
          </div>

          <div className="bg-white border border-[var(--border)] rounded-3xl p-8 shadow-sm hover:shadow-md transition-shadow group">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-6 w-6 text-[var(--primary)]" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-[var(--foreground)]">Disputes, resolved</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Disagree on who won? Both of you submit evidence and Vouchit decides, then
              triggers the payout on-chain. If nobody joins your wager, the contract refunds
              you in full.
            </p>
          </div>

        </div>

      </main>

      {/* Simple Footer */}
      {/* A real-money wagering product shipped with no terms, no privacy
          policy and no age or jurisdiction notice anywhere on the site. */}
      <footer className="w-full py-8 px-6 text-center text-[var(--muted-foreground)] text-sm border-t border-[var(--border)] mt-auto relative z-10 bg-[var(--background)]">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-4">
          <Link href="/legal/terms" className="hover:text-[var(--foreground)] transition-colors">Terms of Service</Link>
          <Link href="/legal/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy Policy</Link>
          <Link href="/legal/responsible-play" className="hover:text-[var(--foreground)] transition-colors">Responsible Play</Link>
        </div>
        <p className="max-w-2xl mx-auto text-xs leading-relaxed mb-3">
          18+ only. Wagering involves risk and you can lose everything you stake. Vouchit is
          not available where peer-to-peer wagering is unlawful — it is your responsibility to
          know the rules where you live. Stakes are crypto assets whose value moves; nothing
          here is financial advice.
        </p>
        <p>&copy; {new Date().getFullYear()} Vouchit. All rights reserved.</p>
      </footer>
    </div>
  );
}
