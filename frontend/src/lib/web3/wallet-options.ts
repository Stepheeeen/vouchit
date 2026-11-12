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
 *
 * Deduplicated, because wagmi reports the same wallet more than once. It
 * surfaces the `injected()` connector we configure AND every wallet that
 * announces itself over EIP-6963, so a browser with only MetaMask installed
 * produced two entries — both reading "Use a browser wallet", both doing the
 * same thing. Seen in the picker before this: one provider, two identical
 * buttons.
 *
 * Where two connectors collide, the named one wins: "MetaMask" tells someone
 * what will open, "Injected" does not.
 */
export function buildWalletOptions(
  connectors: ReadonlyArray<{ id: string; name: string }>,
): WalletOption[] {
  const rank: Record<WalletKind, number> = { passkey: 0, mobile: 1, extension: 2 };
  const classified = connectors.map((c) => ({ id: c.id, name: c.name, kind: classifyConnector(c) }));

  const extensions = classified.filter((c) => c.kind === "extension");
  const named = extensions.filter((c) => !isGeneric(c));

  // The generic `injected()` connector means "whatever extension is
  // installed". When EIP-6963 has already named those extensions, it is a
  // duplicate of one of them — so it only earns a place if nothing else did.
  const keptExtensions = named.length > 0 ? named : extensions.slice(0, 1);

  const deduped = new Map<string, WalletOption>();
  for (const c of keptExtensions) {
    const key = normaliseName(c.name);
    if (!deduped.has(key)) deduped.set(key, c);
  }

  // Passkey and mobile are single well-known routes; collapse each to one.
  const firstOfKind = (kind: WalletKind) => classified.find((c) => c.kind === kind);
  const result: WalletOption[] = [];
  const passkey = firstOfKind("passkey");
  const mobile = firstOfKind("mobile");
  if (passkey) result.push(passkey);
  if (mobile) result.push(mobile);
  result.push(...deduped.values());

  return result.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** "MetaMask Wallet" and "MetaMask" are the same thing to a user. */
function normaliseName(name: string) {
  return name.toLowerCase().replace(/wallet/g, "").replace(/[^a-z0-9]/g, "").trim();
}

/** The catch-all injected connector, as opposed to a named wallet. */
function isGeneric(c: { id: string; name: string }) {
  return /^(injected|browser wallet|unknown)$/i.test(c.name.trim());
}

/**
 * Whether Coinbase is reachable from this browser.
 *
 * The passkey route opens a popup on keys.coinbase.com. Coinbase restricts
 * access in a number of countries — Nigeria among them, which is the market
 * this is built for — and a tester reported needing a VPN to reach it at all.
 * Leading with "Recommended" on the one option that cannot work for them is
 * the worst thing the picker could do.
 *
 * Detection is deliberately modest about itself. A network-level block (DNS
 * or TCP) makes this throw and is caught; a soft block that answers with a
 * 403 page looks identical to success through an opaque no-cors response, so
 * it is NOT caught. That is why the picker also carries a plain warning on
 * the passkey option regardless of what this returns — the probe improves the
 * ordering, it does not decide whether to tell the truth.
 */
export async function isCoinbaseReachable(timeoutMs = 4000): Promise<boolean> {
  if (typeof fetch !== "function") return true;
  try {
    await fetch("https://keys.coinbase.com/connect", {
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reorder so an option that cannot work does not lead.
 *
 * Only demotes; it never promotes something above a route that works.
 */
export function applyReachability(
  options: WalletOption[],
  coinbaseReachable: boolean,
): WalletOption[] {
  if (coinbaseReachable) return options;
  const blocked = options.filter((o) => o.kind === "passkey");
  const rest = options.filter((o) => o.kind !== "passkey");
  // Keep it listed rather than hiding it: a VPN user can still choose it,
  // and silently removing an option is its own kind of confusing.
  return [...rest, ...blocked];
}
