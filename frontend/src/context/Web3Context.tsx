"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { userApi, web3Api } from "@/lib/api";

interface Web3ContextType {
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  signMessage: (message: string) => Promise<string | null>;
  linkWalletToBackend: () => Promise<boolean>;
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  connectWallet: async () => null,
  disconnectWallet: () => {},
  signMessage: async () => null,
  linkWalletToBackend: async () => false,
});

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Check if wallet was previously connected
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      }).catch(console.error);

      ethereum.request({ method: "eth_chainId" }).then((hexChainId: string) => {
        setChainId(parseInt(hexChainId, 16));
      }).catch(console.error);

      const handleAccountsChanged = (accounts: string[]) => {
        setAccount(accounts.length > 0 ? accounts[0] : null);
      };

      const handleChainChanged = (hexChainId: string) => {
        setChainId(parseInt(hexChainId, 16));
      };

      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("chainChanged", handleChainChanged);

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener("accountsChanged", handleAccountsChanged);
          ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, []);

  const connectWallet = async (): Promise<string | null> => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("No EVM wallet found! Please install MetaMask or another Web3 browser extension.");
      return null;
    }

    try {
      setIsConnecting(true);
      const ethereum = (window as any).ethereum;
      const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
      const hexChainId: string = await ethereum.request({ method: "eth_chainId" });
      
      const selectedAccount = accounts[0];
      setAccount(selectedAccount);
      setChainId(parseInt(hexChainId, 16));
      return selectedAccount;
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setChainId(null);
  };

  const signMessage = async (message: string): Promise<string | null> => {
    if (!account || typeof window === "undefined" || !(window as any).ethereum) {
      return null;
    }

    try {
      const ethereum = (window as any).ethereum;
      const signature: string = await ethereum.request({
        method: "personal_sign",
        params: [message, account],
      });
      return signature;
    } catch (err: any) {
      console.error("Message signing failed:", err);
      return null;
    }
  };

  const linkWalletToBackend = async (): Promise<boolean> => {
    let currentAccount = account;
    if (!currentAccount) {
      currentAccount = await connectWallet();
    }
    if (!currentAccount) return false;

    // Fetch user profile from API to get userId
    try {
      const profile = await userApi.getProfile();
      const userId = profile.id;
      const message = `Sign to verify ownership of wallet ${currentAccount} for Vouchit account ${userId}`;
      
      const signature = await signMessage(message);
      if (!signature) return false;

      await web3Api.linkWallet(currentAccount, signature);

      return true;
    } catch (err: any) {
      console.error("Link wallet to backend failed:", err);
      alert(err.message || "Failed to link wallet");
      return false;
    }
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        isConnected: !!account,
        isConnecting,
        connectWallet,
        disconnectWallet,
        signMessage,
        linkWalletToBackend,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => useContext(Web3Context);
