"use client";

import { useState } from "react";
import { Fingerprint, Smartphone, Puzzle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWeb3 } from "@/context/Web3Context";

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
    blurb: "Fastest if you're new. Face ID or fingerprint — no app, no seed phrase.",
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

  // Nothing to choose between: don't put a dialog in front of a single option.
  const singleOption = availableWallets.length <= 1;

  const choose = async (walletId: string) => {
    setBusyId(walletId);
    try {
      await connectWallet({ walletId });
      setOpen(false);
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

            <div className="p-4 flex flex-col gap-2">
              {availableWallets.map((w) => {
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
                        {w.kind === "passkey" && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
                            Recommended
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                        {copy.blurb}
                      </span>
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
