/**
 * Turning wagmi's connector list into the choices we show people.
 *
 * Kept out of the component so it can be exercised directly. The risks here
 * are both silent: labelling a connector as the wrong kind (telling someone
 * to "scan a code" when the button opens a browser extension), or offering an
 * option that is not actually configured — WalletConnect without a project id
 * fails the instant it is tapped, which is worse than never listing it.
 */

export type WalletKind = "passkey" | "mobile" | "extension";

export interface WalletOption {
  id: string;
  name: string;
  kind: WalletKind;
}

/** Classify one connector from what it reports about itself. */
export function classifyConnector(connector: { id: string; name: string }): WalletKind {
  const tag = `${connector.id} ${connector.name}`;
  if (/coinbase|smart/i.test(tag)) return "passkey";
  if (/walletconnect/i.test(tag)) return "mobile";
  return "extension";
}

/**
 * Build the picker's list. Order matters: the passkey route is the one a
 * newcomer should take, so it leads.
 */
export function buildWalletOptions(
  connectors: ReadonlyArray<{ id: string; name: string }>,
): WalletOption[] {
  const rank: Record<WalletKind, number> = { passkey: 0, mobile: 1, extension: 2 };
  return connectors
    .map((c) => ({ id: c.id, name: c.name, kind: classifyConnector(c) }))
    .sort((a, b) => rank[a.kind] - rank[b.kind]);
}
