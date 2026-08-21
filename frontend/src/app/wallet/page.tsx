"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Shield, Copy, ExternalLink, Loader2, Wallet as WalletIcon, Check } from "lucide-react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { useWeb3 } from "@/context/Web3Context";
import { ACTIVE_CHAIN } from "@/lib/web3/config";
import { getTokens, isNativeToken } from "@/lib/web3/tokens";
import { erc20Abi } from "@/lib/web3/escrowAbi";
import { formatStakeCompact, formatStake, applyProtocolFee, sumByToken, formatEarnings } from "@/lib/web3/format";

/** Balance row for one supported stake token. */
function TokenBalance({ token }: { token: ReturnType<typeof getTokens>[number] }) {
  const { address } = useAccount();
  const native = isNativeToken(token.address);

  const nativeBalance = useBalance({
    address,
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: !!address && native },
  });

  const erc20Balance = useReadContract({
    abi: erc20Abi,
    address: token.address,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: !!address && !native },
  });

  const value = native ? nativeBalance.data?.value : (erc20Balance.data as bigint | undefined);
  const isLoading = native ? nativeBalance.isLoading : erc20Balance.isLoading;

  return (
    <div className="flex items-center justify-between py-4 border-b border-[var(--border)] last:border-b-0">
      <div>
        <p className="font-semibold text-sm">{token.symbol}</p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-0.5">
          {token.name}
        </p>
      </div>
      <p className="font-bold text-lg tracking-tight">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
        ) : (
          formatStakeCompact(value ?? 0n, { tokenSymbol: token.symbol, tokenDecimals: token.decimals })
        )}
      </p>
    </div>
  );
}

export default function WalletPage() {
  const { account, isConnected, isCorrectChain, isConnecting, connectWallet } = useWeb3();
  const [wagers, setWagers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const { linkWalletToBackend } = useWeb3();

  const tokens = getTokens(ACTIVE_CHAIN.id);

  useEffect(() => {
    const load = async () => {
      try {
        const { userApi, wagersApi } = await import("@/lib/api");
        const [profile, myWagers] = await Promise.all([
          userApi.getProfile().catch(() => null),
          wagersApi.getMy().catch(() => []),
        ]);
        setUser(profile);
        setWagers(myWagers ?? []);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const linkedAddress: string | null = user?.web3Address ?? null;
  const isLinkedToThisAccount =
    !!linkedAddress && !!account && linkedAddress.toLowerCase() === account.toLowerCase();

  const openWagers = wagers.filter((w) => w.status === "ACTIVE" || w.status === "PENDING_FUNDING");
  const wonWagers = wagers.filter((w) => w.status === "SETTLED" && w.winnerId === user?.id);

  const inEscrowByToken = sumByToken(openWagers, (w) => {
    const mine = w.participants?.find((p: any) => p.userId === user?.id);
    try {
      return BigInt(mine?.amount ?? "0");
    } catch {
      return 0n;
    }
  });
  const wonByToken = sumByToken(wonWagers, (w) => applyProtocolFee(w.totalPot).payout);

  const copyAddress = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLink = async () => {
    setIsLinking(true);
    try {
      if (await linkWalletToBackend()) {
        const { userApi } = await import("@/lib/api");
        setUser(await userApi.getProfile().catch(() => user));
      }
    } finally {
      setIsLinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="sticky top-0 z-20 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3 md:hidden">
        <Link href="/dashboard">
          <button className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <h1 className="font-bold text-base flex-1">Wallet</h1>
      </div>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6 tracking-tight">
        <div className="hidden md:block">
          <h1 className="font-bold text-2xl tracking-tight">Wallet</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Your funds stay in your own wallet. Vouchit never holds them.
          </p>
        </div>

        {/* Connection */}
        {!isConnected ? (
          <div className="border border-[var(--border)] rounded-2xl p-6 flex flex-col items-start gap-3 bg-white" style={{ boxShadow: "var(--shadow-sm)" }}>
            <WalletIcon className="h-6 w-6 text-[var(--primary)]" />
            <p className="font-bold text-lg">Connect your wallet</p>
            <p className="text-xs text-[var(--muted-foreground)] font-medium leading-relaxed">
              Sign in with a passkey — no extension, no seed phrase. Your stakes go straight into the
              escrow contract on {ACTIVE_CHAIN.name}.
            </p>
            <Button onClick={() => connectWallet()} disabled={isConnecting} className="mt-2">
              {isConnecting ? "CONNECTING…" : "CONNECT WALLET"}
            </Button>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#0d9488,#115e59)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative z-10">
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-1">
                Connected Wallet · {ACTIVE_CHAIN.name}
              </p>
              <button onClick={copyAddress} className="flex items-center gap-2 text-white font-bold text-xl tracking-tight">
                {account?.slice(0, 10)}…{account?.slice(-8)}
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-60" />}
              </button>

              {!isCorrectChain && (
                <p className="mt-3 text-[11px] font-semibold text-amber-200">
                  Wrong network — switch to {ACTIVE_CHAIN.name}.
                </p>
              )}

              {!isLinkedToThisAccount && (
                <div className="mt-4 bg-white/10 rounded-xl p-4">
                  <p className="text-white/80 text-[11px] font-semibold leading-relaxed mb-3">
                    {linkedAddress
                      ? "A different wallet is linked to your Vouchit account. Link this one to use it for wagers."
                      : "Link this wallet to your account so payouts and disputes can find you."}
                  </p>
                  <button
                    onClick={handleLink}
                    disabled={isLinking}
                    className="text-[11px] font-bold uppercase tracking-widest bg-white text-[var(--primary)] rounded-lg px-4 py-2 disabled:opacity-60"
                  >
                    {isLinking ? "Signing…" : "Link this wallet"}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 bg-white/10 rounded-xl p-4 mt-4">
                <div className="flex-1 min-w-[110px]">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">In Escrow</p>
                  <p className="text-white font-semibold text-base mt-0.5">{formatEarnings(inEscrowByToken)}</p>
                </div>
                <div className="h-8 w-px bg-white/20 hidden sm:block" />
                <div className="flex-1 min-w-[110px]">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">All-Time Won</p>
                  <p className="text-white font-semibold text-base mt-0.5">{formatEarnings(wonByToken)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Balances */}
        {isConnected && (
          <div className="bg-white border border-[var(--border)] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">
              Balances
            </p>
            {tokens.map((token) => (
              <TokenBalance key={token.address} token={token} />
            ))}
            <p className="text-[10px] text-[var(--muted-foreground)] font-medium mt-4 leading-relaxed">
              These are read directly from {ACTIVE_CHAIN.name}. To add funds, send them to your address
              above from an exchange or another wallet.
            </p>
          </div>
        )}

        {/* Escrow positions */}
        <div className="bg-white border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--primary)]" />
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Escrow Activity
            </p>
          </div>
          {wagers.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted-foreground)] text-sm font-medium">
              No wagers yet.
            </div>
          ) : (
            wagers.slice(0, 10).map((w) => {
              const mine = w.participants?.find((p: any) => p.userId === user?.id);
              const isWin = w.status === "SETTLED" && w.winnerId === user?.id;
              const isLoss = w.status === "SETTLED" && w.winnerId && w.winnerId !== user?.id;
              return (
                <Link
                  key={w.id}
                  href={`/vouch/${w.id}`}
                  className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)]/40 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-semibold text-sm truncate">{w.description}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mt-0.5">
                      {w.status} · {new Date(w.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p
                    className={`font-bold text-sm shrink-0 ${
                      isWin ? "text-[var(--success)]" : isLoss ? "text-[var(--danger)]" : ""
                    }`}
                  >
                    {isWin
                      ? `+${formatStake(applyProtocolFee(w.totalPot).payout, w)}`
                      : `${isLoss ? "−" : ""}${formatStake(mine?.amount, w)}`}
                  </p>
                </Link>
              );
            })
          )}
        </div>

        {account && (
          <a
            href={`${ACTIVE_CHAIN.blockExplorers?.default.url}/address/${account}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--primary)] py-2"
          >
            View on {ACTIVE_CHAIN.blockExplorers?.default.name} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </main>
    </div>
  );
}
