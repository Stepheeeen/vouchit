"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Plus, Shield, Copy, ExternalLink, Loader2 } from "lucide-react";

export const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank", code: "023" },
  { name: "Ecobank", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "OPay", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" },
  { name: "Rubies Bank", code: "125" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "Suntrust Bank", code: "100" },
  { name: "Taj Bank", code: "302" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "VFD Microfinance Bank", code: "566" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" }
];

export default function WalletPage() {
  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const [wallet, setWallet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const [bankAccount, setBankAccount] = useState<{ accountName: string; accountNumber: string; bankName: string; bankCode?: string } | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState("");

  useEffect(() => {
    const resolve = async () => {
      if (accountNumber.length === 10 && bankCode) {
        setIsResolving(true);
        setResolutionError("");
        setAccountName("");
        try {
          const { walletApi } = await import("@/lib/api");
          const res = await walletApi.resolveBank(accountNumber, bankCode);
          setAccountName(res.accountName);
        } catch (err: any) {
          setResolutionError(err.message || "Failed to resolve bank account details.");
        } finally {
          setIsResolving(false);
        }
      } else {
        setAccountName("");
        setResolutionError("");
      }
    };
    resolve();
  }, [accountNumber, bankCode]);

  useEffect(() => {
    if (!showBankModal) {
      setBankName("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
      setResolutionError("");
    }
  }, [showBankModal]);


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
    const fetchBank = async () => {
      try {
        const { walletApi } = await import("@/lib/api");
        const bank = await walletApi.getLinkedBank();
        if (bank) {
          setBankAccount(bank);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchBank();
  }, []);

  const handleDeposit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount))) return;
    setIsDepositing(true);
    setDepositError("");
    try {
      const { walletApi } = await import("@/lib/api");
      const res = await walletApi.initializeDeposit(Number(depositAmount));
      if (res.authorization_url) {
        window.location.href = res.authorization_url;
      }
    } catch (e: any) {
      setDepositError(e.message || "Failed to initialize deposit");
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!withdrawAmount || isNaN(amount) || amount <= 0) return;
    if (!bankAccount) {
      setWithdrawError("Please link a bank account before making withdrawals.");
      return;
    }
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
      const { toast } = await import("sonner");
      toast.success(`Withdrawal of ₦${amount.toLocaleString()} submitted! It may take a few minutes to arrive.`);
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
            {depositError && (
              <div className="mb-4 p-3 border border-[var(--danger)]/30 bg-red-50 text-red-700 text-xs font-semibold rounded-xl">
                {depositError}
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Amount (NGN)</label>
                <input 
                  type="number"
                  value={depositAmount}
                  onChange={(e) => {
                    setDepositAmount(e.target.value);
                    setDepositError("");
                  }}
                  placeholder="e.g. 5000"
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-lg"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowDepositModal(false);
                    setDepositError("");
                  }}
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
                <div className="relative mt-1">
                  <input 
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value);
                      setWithdrawError("");
                    }}
                    placeholder="e.g. 5000"
                    className="w-full p-3 border border-[var(--border)] rounded-xl font-semibold text-lg pr-16"
                  />
                  <button
                    onClick={() => {
                      if (wallet?.availableBalance) {
                        setWithdrawAmount(wallet.availableBalance.toString());
                        setWithdrawError("");
                      }
                    }}
                    className="absolute right-2 top-2 bottom-2 px-3 text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 rounded-lg transition-colors"
                  >
                    MAX
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Available: {formatMoney(wallet?.availableBalance || 0)}
                  </p>
                  {Number(withdrawAmount) >= 1000 && (
                    <p className="text-[10px] font-medium text-[var(--muted-foreground)] text-right">
                      {Number(wallet?.availableBalance) >= Number(withdrawAmount) + Math.ceil(Number(withdrawAmount) * 0.02)
                        ? `Fee: ₦${Math.ceil(Number(withdrawAmount) * 0.02)} | You Receive: ₦${Number(withdrawAmount)}`
                        : `Fee: ₦${Math.ceil(Number(withdrawAmount) * 0.02)} | You Receive: ₦${Number(withdrawAmount) - Math.ceil(Number(withdrawAmount) * 0.02)}`
                      }
                    </p>
                  )}
                </div>
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
                  disabled={isWithdrawing || !withdrawAmount || Number(withdrawAmount) < 1000 || Number(withdrawAmount) > (wallet?.availableBalance || 0)}
                  className="flex-1 py-3 font-semibold bg-[var(--primary)] text-white rounded-xl disabled:opacity-50 flex justify-center items-center"
                >
                  {isWithdrawing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Withdraw"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Bank Account Modal */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Link Bank Account</h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Enter your bank details to link your account for withdrawals.
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Select Bank</label>
                <select
                  value={bankCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setBankCode(code);
                    const selected = NIGERIAN_BANKS.find(b => b.code === code);
                    setBankName(selected ? selected.name : "");
                  }}
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-sm bg-white"
                >
                  <option value="">Select a Bank</option>
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Account Number</label>
                <input 
                  type="text"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 0123456789"
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-sm"
                />
                {isResolving && (
                  <p className="text-xs text-[var(--primary)] flex items-center gap-1.5 mt-1 font-semibold">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verifying account details...
                  </p>
                )}
                {resolutionError && (
                  <p className="text-xs text-[var(--danger)] mt-1 font-semibold">
                    {resolutionError}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Account Name</label>
                <input 
                  type="text"
                  value={accountName}
                  readOnly
                  placeholder={isResolving ? "Resolving account name..." : "Account name will auto-resolve"}
                  className="w-full mt-1 p-3 border border-[var(--border)] rounded-xl font-semibold text-sm bg-neutral-50 text-neutral-500 cursor-not-allowed"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 py-3 font-semibold border border-[var(--border)] rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!bankName || !accountNumber || !accountName) return;
                    setIsResolving(true);
                    try {
                      const { walletApi } = await import("@/lib/api");
                      const data = { bankName, bankCode, accountNumber, accountName };
                      await walletApi.linkBank(data);
                      setBankAccount(data);
                      setShowBankModal(false);
                      const { toast } = await import("sonner");
                      toast.success("Bank account linked successfully!");
                    } catch (err: any) {
                      setResolutionError(err.message || "Failed to link bank account");
                    } finally {
                      setIsResolving(false);
                    }
                  }}
                  disabled={!bankName || accountNumber.length !== 10 || !accountName || isResolving}
                  className="flex-1 py-3 font-semibold bg-[var(--primary)] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                >
                  {isResolving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Link Account"}
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
                  {bankAccount ? (
                    <p className="font-semibold text-sm">
                      {bankAccount.bankName} •••• {bankAccount.accountNumber.slice(-4)}
                    </p>
                  ) : (
                    <p className="font-semibold text-sm">None Linked</p>
                  )}
                </div>
              </div>
              {bankAccount ? (
                <button 
                  onClick={async () => {
                    try {
                      const { walletApi } = await import("@/lib/api");
                      await walletApi.unlinkBank();
                      setBankAccount(null);
                      setBankName("");
                      setAccountNumber("");
                      setAccountName("");
                      const { toast } = await import("sonner");
                      toast.success("Bank account unlinked successfully!");
                    } catch (e: any) {
                      const { toast } = await import("sonner");
                      toast.error("Failed to unlink bank account");
                    }
                  }}
                  className="text-red-500 flex items-center gap-1 text-xs font-semibold hover:underline"
                >
                  Unlink
                </button>
              ) : (
                <button 
                  onClick={() => setShowBankModal(true)}
                  className="text-[var(--primary)] flex items-center gap-1 text-xs font-semibold hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
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
