"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { WagmiProvider, useAccount, useChainId, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { userApi, web3Api } from "@/lib/api";
import { wagmiConfig, ACTIVE_CHAIN } from "@/lib/web3/config";

interface Web3ContextType {
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  /** True when the connected wallet is on the network the escrow is deployed to. */
  isCorrectChain: boolean;
  /** Passkey / smart-wallet sign-in. Falls back to a browser wallet if present. */
  connectWallet: (options?: { useBrowserWallet?: boolean }) => Promise<string | null>;
  disconnectWallet: () => void;
  signMessage: (message: string) => Promise<string | null>;
  linkWalletToBackend: () => Promise<boolean>;
}

const noop = {
  account: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  isCorrectChain: false,
  connectWallet: async () => null,
  disconnectWallet: () => {},
  signMessage: async () => null,
  linkWalletToBackend: async () => false,
};

const Web3Context = createContext<Web3ContextType>(noop);

const queryClient = new QueryClient();

function Web3StateProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isLinking, setIsLinking] = useState(false);

  const connectWallet = useCallback(
    async (options?: { useBrowserWallet?: boolean }) => {
      // connectors[0] is the Coinbase Smart Wallet (passkey), [1] is injected.
      const connector = options?.useBrowserWallet
        ? connectors.find((c) => c.id === "injected") ?? connectors[0]
        : connectors[0];
      if (!connector) return null;

      try {
        const result = await connectAsync({ connector, chainId: ACTIVE_CHAIN.id });
        return result.accounts[0] ?? null;
      } catch (err) {
        console.error("Wallet connection failed:", err);
        return null;
      }
    },
    [connectAsync, connectors],
  );

  const signMessage = useCallback(
    async (message: string) => {
      try {
        return await signMessageAsync({ message });
      } catch (err) {
        console.error("Message signing failed:", err);
        return null;
      }
    },
    [signMessageAsync],
  );

  /**
   * Prove ownership of the connected address to the API so it persists on the
   * user record. The message format must stay in lockstep with
   * Web3Service.linkWallet on the backend.
   */
  const linkWalletToBackend = useCallback(async () => {
    if (isLinking) return false;
    setIsLinking(true);
    try {
      const currentAccount = address ?? (await connectWallet());
      if (!currentAccount) return false;

      const profile = await userApi.getProfile();
      const message = `Sign to verify ownership of wallet ${currentAccount} for Vouchit account ${profile.id}`;
      const signature = await signMessage(message);
      if (!signature) return false;

      await web3Api.linkWallet(currentAccount, signature);
      return true;
    } catch (err: any) {
      console.error("Link wallet to backend failed:", err);
      const { toast } = await import("sonner");
      toast.error(err?.message || "Failed to link wallet");
      return false;
    } finally {
      setIsLinking(false);
    }
  }, [address, connectWallet, isLinking, signMessage]);

  const value = useMemo(
    () => ({
      account: address ?? null,
      chainId: chainId ?? null,
      isConnected,
      isConnecting: isPending || isLinking,
      isCorrectChain: chainId === ACTIVE_CHAIN.id,
      connectWallet,
      disconnectWallet: () => disconnect(),
      signMessage,
      linkWalletToBackend,
    }),
    [address, chainId, isConnected, isPending, isLinking, connectWallet, disconnect, signMessage, linkWalletToBackend],
  );

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export const Web3Provider = ({ children }: { children: React.ReactNode }) => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <Web3StateProvider>{children}</Web3StateProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export const useWeb3 = () => useContext(Web3Context);
