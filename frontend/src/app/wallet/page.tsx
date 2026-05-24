"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Plus, Shield, Copy, ExternalLink, Loader2 } from "lucide-react";

export default function WalletPage() {
  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const [wallet, setWallet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const loadWallet = async () => {
    try {
      const { walletApi } = await import("@/lib/api");
      const data = await walletApi.getBalances();
      setWallet(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const handleDeposit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount))) return;
    setIsDepositing(true);
    try {
      const { walletApi } = await import("@/lib/api");
      const res = await walletApi.initializeDeposit(Number(depositAmount));
      if (res.authorization_url) {
        window.location.href = res.authorization_url;
      }
    } catch (e: any) {
      alert(e.message || "Failed to initialize deposit");
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!withdrawAmount || isNaN(amount) || amount <= 0) return;
    if (amount > (wallet?.availableBalance || 0)) {
      setWithdrawError("Amount exceeds available balance.");
      return;
    }
    setIsWithdrawing(true);
    setWithdrawError("");
    try {
      const { walletApi } = await import("@/lib/api");
      await walletApi.withdraw(amount);
      setWithdrawAmount("");
      setShowWithdrawModal(false);
      await loadWallet();
    } catch (e: any) {
      setWithdrawError(e.message || "Failed to process withdrawal.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  const txns = wallet?.ledgerEntries || [];
  const filtered = txns.filter((t: any) =>
    tab === "all" ? true :
    tab === "in"  ? ["DEPOSIT", "WIN", "ESCROW_RELEASE"].includes(t.type) :
    ["WITHDRAWAL", "ESCROW_LOCK", "FEE"].includes(t.type)
  );

  const formatMoney = (val: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(val);

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Fund Wallet</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Amount (NGN)</label>
                <input 
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-lg"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 py-3 font-semibold border border-[var(--border)] rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  disabled={isDepositing}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeposit}
                  disabled={isDepositing || !depositAmount}
                  className="flex-1 py-3 font-semibold bg-[var(--primary)] text-white rounded-xl disabled:opacity-50 flex justify-center items-center"
                >
                  {isDepositing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Pay with Paystack"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Withdraw Funds</h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Enter the amount to withdraw to your linked bank account.
            </p>
            {withdrawError && (
              <div className="mb-4 p-3 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                {withdrawError}
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Amount (NGN)</label>
                <input 
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => {
                    setWithdrawAmount(e.target.value);
                    setWithdrawError("");
                  }}
                  placeholder="e.g. 5000"
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-lg"
                />
                <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                  Available: {formatMoney(wallet?.availableBalance || 0)}
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 font-semibold border border-[var(--border)] rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  disabled={isWithdrawing}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > (wallet?.availableBalance || 0)}
                  className="flex-1 py-3 font-semibold bg-[var(--primary)] text-white rounded-xl disabled:opacity-50 flex justify-center items-center"
                >
                  {isWithdrawing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Withdraw"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page back header */}
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 md:px-8 lg:px-12 py-3 flex items-center gap-3 md:hidden">
        <Link href="/">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <h1 className="font-bold text-base">Wallet</h1>
      </div>

      <main className="flex-1 w-full px-4 md:px-8 lg:px-12 py-6 md:py-8 flex flex-col gap-8">

        {/* Desktop page title */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl tracking-tight">Wallet</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Manage your balance, deposits and withdrawals.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowWithdrawModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm font-semibold hover:bg-[var(--muted)] transition-colors" style={{ boxShadow: "var(--shadow-sm)" }}>
              <ArrowDownRight className="h-4 w-4" /> Withdraw
            </button>
            <button
              onClick={() => setShowDepositModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
              style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}
            >
              <Plus className="h-4 w-4" /> Fund Wallet
            </button>
          </div>
        </div>

        {/* Top grid: Balance Hero + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero */}
          <div
            className="lg:col-span-2 rounded-2xl p-6 md:p-8 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute top-4 right-4 opacity-10">
              <Shield className="h-28 w-28 text-white" />
            </div>
            <div className="relative z-10">
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">Available to Withdraw</p>
              <p className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
                {formatMoney(wallet?.availableBalance || 0)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/15 rounded-xl p-3 md:p-4">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">In Escrow</p>
                  <p className="text-white font-bold text-xl md:text-2xl mt-1">{formatMoney(wallet?.escrowBalance || 0)}</p>
                </div>
                <div className="bg-white/15 rounded-xl p-3 md:p-4">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">Locked</p>
                  <p className="text-white font-bold text-xl md:text-2xl mt-1">{formatMoney(wallet?.lockedBalance || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: actions + bank account */}
          <div className="flex flex-col gap-4">
            {/* Mobile buttons only */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <button
                onClick={() => setShowDepositModal(true)}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-[var(--primary)] bg-[var(--primary)] text-white font-semibold text-sm"
                style={{ boxShadow: "0 4px 12px rgba(13,148,136,0.25)" }}
              >
                <Plus className="h-4 w-4" /> Fund
              </button>
              <button 
                onClick={() => setShowWithdrawModal(true)}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-[var(--border)] bg-white text-[var(--foreground)] font-semibold text-sm">
                <ArrowDownRight className="h-4 w-4" /> Withdraw
              </button>
            </div>

            {/* Bank account */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                  <ExternalLink className="h-4 w-4 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] font-semibold">Linked Account</p>
                  <p className="font-semibold text-sm">None Linked</p>
                </div>
              </div>
              <button className="text-[var(--primary)] flex items-center gap-1 text-xs font-semibold hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Transaction History</h2>
            <div className="flex bg-[var(--muted)] rounded-full p-0.5 gap-0.5">
              {(["all","in","out"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                    tab === t ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {t === "all" ? "All" : t === "in" ? "In" : "Out"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted-foreground)] text-sm font-medium">No transactions found.</div>
            ) : filtered.map((txn: any, i: number) => {
              const isPositive = ["DEPOSIT", "WIN", "ESCROW_RELEASE"].includes(txn.type);
              const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
              return (
                <div key={i} className={`flex items-center gap-4 p-4 hover:bg-[var(--muted)] transition-colors ${i < filtered.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isPositive ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <Icon className={`h-4 w-4 ${isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{txn.description || txn.type}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{new Date(txn.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {isPositive ? '+' : '-'}{formatMoney(Math.abs(txn.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
