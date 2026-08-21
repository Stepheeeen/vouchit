/**
 * Stub for wagmi's optional connector peer dependencies (`accounts` for Tempo
 * Wallet, `@walletconnect/ethereum-provider` for WalletConnect).
 *
 * `@wagmi/connectors` is a barrel that re-exports every connector, so bundling
 * pulls these into the graph even though we only use Coinbase Smart Wallet and
 * the injected connector. They are declared optional peer dependencies, so
 * rather than installing wallet SDKs we never instantiate, we alias them to this
 * stub — see `resolveAlias`/`resolve.alias` in next.config.ts.
 *
 * If either connector is ever added, install the real package and drop its alias.
 */
const unavailable = () => {
  throw new Error("The Tempo Wallet connector is not installed in this app.");
};

export const dialog = unavailable;
export default { dialog: unavailable };
