"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, ExternalLink, AlertTriangle } from "lucide-react";
import { ACTIVE_CHAIN } from "@/lib/web3/config";

/**
 * Getting money in and out.
 *
 * The app had neither. A new user connected a passkey wallet, landed on an
 * empty balance, and was given no indication of what to do next — the only
 * route was to already know that you buy crypto elsewhere, withdraw it on the
 * Base network specifically, and paste a 42-character address. Most people
 * stop there, and the ones who don't are one wrong-network choice away from
 * losing the money.
 *
 * This is the honest version of that path rather than a custodial balance:
 * Vouchit still never holds the funds. A one-click onramp can be slotted in
 * later by setting NEXT_PUBLIC_COINBASE_ONRAMP_APP_ID — see the note on
 * `onrampUrl` below.
 */

const ONRAMP_APP_ID = process.env.NEXT_PUBLIC_COINBASE_ONRAMP_APP_ID;

function onrampUrl(address: string): string | null {
  // Coinbase Onramp needs a registered app id from the CDP portal. Without
  // one there is no honest one-click flow, so the panel falls back to showing
  // the address and the network rule instead of linking somewhere that will
  // reject the user.
  if (!ONRAMP_APP_ID || !address) return null;
  const params = new URLSearchParams({
    appId: ONRAMP_APP_ID,
    addresses: JSON.stringify({ [address]: ["base"] }),
    assets: JSON.stringify(["ETH", "USDC"]),
  });
  return `https://pay.coinbase.com/buy/select-asset?${params.toString()}`;
}

export function AddFunds({ address }: { address: string }) {
  const [tab, setTab] = useState<"in" | "out">("in");
  const [copied, setCopied] = useState(false);
  const buyUrl = onrampUrl(address);

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex border-b border-[var(--border)]" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "in"}
          onClick={() => setTab("in")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
            tab === "in"
              ? "bg-[var(--muted)] text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
          }`}
        >
          <ArrowDownToLine className="h-4 w-4" /> Add funds
        </button>
        <button
          role="tab"
          aria-selected={tab === "out"}
          onClick={() => setTab("out")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
            tab === "out"
              ? "bg-[var(--muted)] text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
          }`}
        >
          <ArrowUpFromLine className="h-4 w-4" /> Cash out
        </button>
      </div>

      <div className="p-6 flex flex-col gap-4">
        {tab === "in" ? (
          <>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              Your stakes come from this wallet, and Vouchit never holds the money. To fund
              it, send <strong className="text-[var(--foreground)]">ETH or USDC</strong> to
              the address below.
            </p>

            {buyUrl && (
              <a
                href={buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)" }}
              >
                Buy with card or bank <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                Your wallet address
              </span>
              <button
                onClick={copy}
                className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 font-mono text-xs break-all text-left hover:bg-[var(--muted)] transition-colors"
              >
                <span>{address}</span>
                {copied ? (
                  <Check className="h-4 w-4 shrink-0 text-[var(--success)]" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                )}
              </button>
            </div>

            {/* The single most expensive mistake available here, stated before
                they go and make it. */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong>Send on the {ACTIVE_CHAIN.name} network only.</strong> When you
                withdraw from an exchange, choose <strong>Base</strong> as the network — not
                Ethereum, not BNB Chain. Funds sent on the wrong network cannot be recovered
                by us or by anyone.
              </div>
            </div>

            <div className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              <p className="font-semibold text-[var(--foreground)] mb-1">Keep a little ETH</p>
              <p>
                Every transaction on Base costs a small network fee paid in ETH — usually
                well under a cent. You need a small amount even if you only ever stake USDC.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              Winnings are paid straight into this wallet by the escrow contract. Vouchit has
              no balance to withdraw from and never takes custody, so cashing out means
              sending from your wallet to somewhere that converts to your local currency.
            </p>
            <ol className="flex flex-col gap-3 text-sm">
              <li className="flex gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs font-bold">1</span>
                <span className="text-[var(--muted-foreground)]">
                  Open your exchange app and copy its <strong className="text-[var(--foreground)]">Base</strong> deposit
                  address for ETH or USDC.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs font-bold">2</span>
                <span className="text-[var(--muted-foreground)]">
                  Send to it from this wallet, choosing <strong className="text-[var(--foreground)]">Base</strong> as the network.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs font-bold">3</span>
                <span className="text-[var(--muted-foreground)]">
                  Sell there and withdraw to your bank as usual.
                </span>
              </li>
            </ol>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                Check your exchange actually supports the Base network for that asset before
                sending. If it does not, bridge to a network it does support first.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
