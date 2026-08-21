import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

/**
 * Which Base network the app talks to. Defaults to Sepolia so a misconfigured
 * deploy can never silently point real funds at mainnet.
 */
export const ACTIVE_CHAIN =
  process.env.NEXT_PUBLIC_CHAIN === "base" ? base : baseSepolia;

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "") as `0x${string}`;

export const isEscrowConfigured = () => /^0x[0-9a-fA-F]{40}$/.test(ESCROW_ADDRESS);

export const wagmiConfig = createConfig({
  // Both chains are declared so the config type is concrete; ACTIVE_CHAIN is what
  // every write targets, and the app never offers the other one in the UI.
  chains: [base, baseSepolia],
  connectors: [
    // `preference: "smartWalletOnly"` gives passkey sign-in (Face ID / fingerprint):
    // no extension, no seed phrase, and gas can be sponsored via Paymaster. This is
    // the low-friction path for people who have never used crypto.
    coinbaseWallet({
      appName: "Vouchit",
      preference: "smartWalletOnly",
    }),
    // Fall back to an existing browser wallet for users who already have one.
    injected({ shimDisconnect: true }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
