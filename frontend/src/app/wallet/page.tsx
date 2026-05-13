"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Plus, Shield, Copy, ExternalLink, ChevronDown } from "lucide-react";

const txns = [
  { type: "win",      label: "Won: Arsenal vs Chelsea",   amount: "+₦10,000", date: "Apr 28, 10:42 AM" },
  { type: "deposit",  label: "Deposit via Paystack",       amount: "+₦20,000", date: "Apr 27, 2:30 PM"  },
  { type: "escrow",   label: "Locked: Marathon Wager",     amount: "−₦2,000",  date: "Apr 27, 11:00 AM" },
  { type: "loss",     label: "Lost: Man Utd vs City",      amount: "−₦3,000",  date: "Apr 25, 9:15 AM"  },
  { type: "deposit",  label: "Deposit via Paystack",       amount: "+₦10,000", date: "Apr 22, 4:00 PM"  },
  { type: "win",      label: "Won: Lakers vs Nuggets",     amount: "+₦8,000",  date: "Apr 20, 8:10 PM"  },
  { type: "escrow",   label: "Locked: Nigeria World Cup",  amount: "−₦5,000",  date: "Apr 18, 9:00 AM"  },
  { type: "win",      label: "Won: BTC Challenge",         amount: "+₦12,000", date: "Apr 15, 3:45 PM"  },
];

const typeColor = (t: string) => (["win","deposit"].includes(t) ? "text-[var(--success)]" : "text-[var(--danger)]");
const typeBg    = (t: string) => t === "win" ? "bg-emerald-50" : t === "deposit" ? "bg-blue-50" : t === "loss" ? "bg-[var(--muted)]" : "bg-amber-50";
const typeIcon  = (t: string) => (["win","deposit"].includes(t) ? ArrowUpRight : ArrowDownRight);

export default function WalletPage() {
  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const filtered = txns.filter(t =>
    tab === "all" ? true :
    tab === "in"  ? ["win","deposit"].includes(t.type) :
    ["loss","escrow"].includes(t.type)
  );

  return (
    <div className="flex-1 flex flex-col">
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
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-white text-sm font-semibold hover:bg-[var(--muted)] transition-colors" style={{ boxShadow: "var(--shadow-sm)" }}>
              <ArrowDownRight className="h-4 w-4" /> Withdraw
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
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
              <p className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">₦24,500<span className="text-white/60 text-2xl">.00</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/15 rounded-xl p-3 md:p-4">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">In Escrow</p>
                  <p className="text-white font-bold text-xl md:text-2xl mt-1">₦12,000</p>
                </div>
                <div className="bg-white/15 rounded-xl p-3 md:p-4">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">All-Time Won</p>
                  <p className="text-white font-bold text-xl md:text-2xl mt-1">₦48,500</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: actions + bank account */}
          <div className="flex flex-col gap-4">
            {/* Mobile buttons only */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <button
                className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-[var(--primary)] bg-[var(--primary)] text-white font-semibold text-sm"
                style={{ boxShadow: "0 4px 12px rgba(13,148,136,0.25)" }}
              >
                <Plus className="h-4 w-4" /> Fund
              </button>
              <button className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-[var(--border)] bg-white text-[var(--foreground)] font-semibold text-sm">
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
                  <p className="font-semibold text-sm">GTBank — ****4521</p>
                </div>
              </div>
              <button className="text-[var(--primary)] flex items-center gap-1 text-xs font-semibold hover:underline">
                <Copy className="h-3.5 w-3.5" /> Change
              </button>
            </div>

            {/* Quick stats */}
            <div className="bg-white border border-[var(--border)] rounded-2xl p-4 flex-1" style={{ boxShadow: "var(--shadow-sm)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">Lifetime Summary</p>
              {[
                { label: "Total Deposited",   value: "₦60,000" },
                { label: "Total Won",         value: "₦48,500" },
                { label: "Total in Fees",     value: "₦1,200"  },
                { label: "Net Profit",        value: "₦11,300" },
              ].map((s, i) => (
                <div key={i} className={`flex justify-between py-2.5 ${i < 3 ? "border-b border-[var(--border)]" : ""}`}>
                  <span className="text-xs text-[var(--muted-foreground)] font-medium">{s.label}</span>
                  <span className="text-xs font-bold text-[var(--foreground)]">{s.value}</span>
                </div>
              ))}
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
            {filtered.map((txn, i) => {
              const Icon = typeIcon(txn.type);
              return (
                <div key={i} className={`flex items-center gap-4 p-4 hover:bg-[var(--muted)] transition-colors ${i < filtered.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${typeBg(txn.type)}`}>
                    <Icon className={`h-4 w-4 ${typeColor(txn.type)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{txn.label}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{txn.date}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${typeColor(txn.type)}`}>{txn.amount}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
