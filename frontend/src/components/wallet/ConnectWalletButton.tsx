"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Smartphone, Puzzle, Loader2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeb3 } from "@/context/Web3Context";
import { applyReachability, isCoinbaseReachable } from "@/lib/web3/wallet-options";

/**
 * Choosing how to sign in.
 *
 * Connecting used to go straight to the Coinbase passkey connector with no
 * choice offered, and the only alternative was a `useBrowserWallet` flag no
 * screen ever set. That left two groups stranded: people who already have a
 * mobile wallet and no reason to create a second one, and people on a phone,
 * where a browser extension does not exist as an option at all. For an
 * audience that is mostly on phones, that was most of them.
 */

const COPY: Record<
  "passkey" | "mobile" | "extension",
  { title: string; blurb: string; icon: typeof Fingerprint }
> = {
  passkey: {
    title: "Create a passkey",
    blurb:
      "Fastest if you're new. Face ID or fingerprint — no app, no seed phrase. Opens Coinbase, which some countries block.",
    icon: Fingerprint,
  },
  mobile: {
    title: "Use a mobile wallet",
    blurb: "Scan a code with Trust, Rainbow, MetaMask or any WalletConnect wallet.",
    icon: Smartphone,
  },
  extension: {
    title: "Use a browser wallet",
    blurb: "Connect an extension you already have installed.",
    icon: Puzzle,
  },
};

export function ConnectWalletButton({
  label = "CONNECT WALLET",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { connectWallet, isConnecting, availableWallets } = useWeb3();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  // null while unknown, so nothing is demoted on a guess.
  const [coinbaseReachable, setCoinbaseReachable] = useState<boolean | null>(null);

  // Checked when the chooser opens rather than on page load: it costs a
  // request, and it only matters at the moment someone is picking.
  useEffect(() => {
    if (!open || coinbaseReachable !== null) return;
    let cancelled = false;
    void isCoinbaseReachable().then((ok) => {
      if (!cancelled) setCoinbaseReachable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [open, coinbaseReachable]);

  const orderedWallets =
    coinbaseReachable === false ? applyReachability(availableWallets, false) : availableWallets;

  // Nothing to choose between: don't put a dialog in front of a single option.
  const singleOption = availableWallets.length <= 1;

  const choose = async (walletId: string) => {
    setBusyId(walletId);
    setFailedId(null);
    try {
      const account = await connectWallet({ walletId });
      if (account) {
        setOpen(false);
      } else {
        // Connecting returned nothing. For the passkey route the usual cause
        // is the Coinbase popup never opening, so say what to do instead of
        // leaving the dialog looking inert.
        setFailedId(walletId);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => (singleOption ? connectWallet() : setOpen(true))}
        disabled={isConnecting}
        className={className}
      >
        {isConnecting ? "CONNECTING…" : label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose how to connect"
            className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="font-bold text-base">Connect a wallet</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="h-8 w-8 rounded-full hover:bg-[var(--muted)] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {coinbaseReachable === false && (
              // A hard network block was detected. Say so plainly rather than
              // letting someone pick the option that just failed a probe.
              <div className="mx-4 mt-4 flex items-start gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs leading-relaxed">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  We can&apos;t reach Coinbase from your connection, so the passkey option
                  probably won&apos;t work here. A mobile wallet works without it.
                </span>
              </div>
            )}

            <div className="p-4 flex flex-col gap-2">
              {orderedWallets.map((w) => {
                const copy = COPY[w.kind];
                const Icon = copy.icon;
                const busy = busyId === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => choose(w.id)}
                    disabled={!!busyId}
                    className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border)] text-left hover:bg-[var(--muted)] transition-colors disabled:opacity-60"
                  >
                    <span className="h-10 w-10 shrink-0 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                      {busy ? (
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
                      ) : (
                        <Icon className="h-5 w-5 text-[var(--primary)]" />
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-semibold text-sm">
                        {/* For an extension, name the wallet that will open.
                            "Use a browser wallet" twice over told nobody
                            which was which. */}
                        {w.kind === "extension" ? `Use ${w.name}` : copy.title}
                        {/* Not recommended when we have just said it probably
                            will not work — the badge and the banner would be
                            telling the reader opposite things. */}
                        {w.kind === "passkey" && coinbaseReachable !== false && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
                            Recommended
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                        {copy.blurb}
                      </span>
                      {failedId === w.id && (
                        <span className="text-xs font-semibold text-[var(--danger)] mt-1 block">
                          {w.kind === "passkey"
                            ? "That didn't open. Coinbase may be blocked on your network — try a mobile wallet instead."
                            : "That didn't connect. Check your wallet app and try again."}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="px-6 pb-6 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              Whichever you choose, the wallet stays yours. Vouchit never holds your funds and
              cannot move them — stakes go straight into the escrow contract on Base.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
