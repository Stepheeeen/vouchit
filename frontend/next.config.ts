import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// See src/lib/web3/optional-connector-stub.ts for why these aliases exist.
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const optionalConnectorStub = path.resolve(rootDir, "src/lib/web3/optional-connector-stub.ts");

/**
 * Optional peer dependencies of `@wagmi/connectors` for wallets this app does
 * not offer. The package is a barrel, so bundlers try to resolve every
 * connector's SDK; these are aliased to a stub instead of installed.
 * `@coinbase/wallet-sdk` and `@base-org/account` are deliberately absent — the
 * Coinbase Smart Wallet connector is the one we actually use.
 */
const UNUSED_CONNECTOR_DEPS = [
  "accounts",
  "@walletconnect/ethereum-provider",
  "@safe-global/safe-apps-provider",
  "@safe-global/safe-apps-sdk",
  "@metamask/connect-evm",
];

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: Object.fromEntries(
      UNUSED_CONNECTOR_DEPS.map((dep) => [dep, optionalConnectorStub]),
    ),
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(UNUSED_CONNECTOR_DEPS.map((dep) => [dep, optionalConnectorStub])),
    };
    return config;
  },
};

export default nextConfig;
