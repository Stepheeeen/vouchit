import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

/**
 * Which Base network the app talks to. Defaults to Sepolia so a misconfigured
 * deploy can never silently point real funds at mainnet.
 */
export const ACTIVE_CHAIN =
  process.env.NEXT_PUBLIC_CHAIN === "base" ? base : baseSepolia;

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "") as `0x${string}`;

/** Free project id from dashboard.reown.com; enables mobile wallets. */
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/** Which sign-in routes are actually available in this deployment. */
export const hasWalletConnect = !!WALLETCONNECT_PROJECT_ID;

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
      preference: { options: "smartWalletOnly" },
    }),
    // WalletConnect reaches the hundreds of mobile wallets people already
    // have — Trust, Rainbow, MetaMask mobile, Ledger Live and the rest. On a
    // phone, which is where most of this audience is, a browser extension is
    // not an option at all, so without this the only route for someone with
    // an existing wallet was "install a desktop extension".
    //
    // Needs a free project id from https://dashboard.reown.com. Omitted
    // rather than included broken when absent: a WalletConnect connector
    // without one fails at the moment the user taps it.
    ...(WALLETCONNECT_PROJECT_ID
      ? [
          walletConnect({
            projectId: WALLETCONNECT_PROJECT_ID,
            metadata: {
              name: "Vouchit",
              description: "The trust layer for social wagers",
              url: "https://www.usevouchit.com",
              icons: ["https://www.usevouchit.com/logo-mark-transparent.png"],
            },
            showQrModal: true,
          }),
        ]
      : []),
    // An existing browser extension, for users who already have one.
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
