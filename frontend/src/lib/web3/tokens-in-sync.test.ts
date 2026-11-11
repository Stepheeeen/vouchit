/**
 * The two token registries must agree.
 *
 * `frontend/src/lib/web3/tokens.ts` decides what the UI offers to stake;
 * `backend/src/web3/tokens.ts` decides what the API will accept. They are
 * separate files that have only ever been kept in step by a comment saying
 * they must be. If they drift, the failure is ugly and expensive: the UI
 * offers a currency, the user approves it, escrows a real stake on-chain, and
 * only then does the API refuse to register the wager — leaving their money
 * locked in the contract with nothing in the app to show for it.
 *
 * A wrong ADDRESS is worse still: the frontend would send the stake to one
 * contract while the backend verifies against another, so this compares
 * addresses case-insensitively, decimals exactly, and the set of symbols per
 * chain.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const backendTokens = resolve(here, "../../../../backend/src/web3/tokens.ts");
const frontendTokens = resolve(here, "./tokens.ts");

/**
 * Pull `{ symbol, address, decimals }` out of a token registry by reading the
 * source. Deliberately textual: importing the backend module would drag in
 * Nest and Prisma for a comparison of six constants.
 */
function parseTokens(path: string) {
  const src = readFileSync(path, "utf8");
  const chains: Record<string, Array<{ symbol: string; address: string; decimals: number }>> = {};

  // Split into chain blocks: `[BASE_MAINNET]: [` / `[base.id]: [`.
  const chainRe = /\[(?:(\w+)|(?:\w+\.id))\]:\s*\[/g;
  const markers: Array<{ key: string; index: number }> = [];
  for (const m of src.matchAll(/\[([A-Za-z_.]+)(?:\.id)?\]:\s*\[/g)) {
    markers.push({ key: m[1].replace(/\.id$/, ""), index: m.index ?? 0 });
  }
  void chainRe;

  markers.forEach((marker, i) => {
    const end = i + 1 < markers.length ? markers[i + 1].index : src.length;
    const block = src.slice(marker.index, end);
    const entries: Array<{ symbol: string; address: string; decimals: number }> = [];
    const entryRe =
      /address:\s*(?:NATIVE_TOKEN_ADDRESS|['"](0x[0-9a-fA-F]{40})['"])[\s\S]*?symbol:\s*['"]([^'"]+)['"][\s\S]*?decimals:\s*(\d+)/g;
    for (const e of block.matchAll(entryRe)) {
      entries.push({
        address: (e[1] ?? "0x0000000000000000000000000000000000000000").toLowerCase(),
        symbol: e[2],
        decimals: Number(e[3]),
      });
    }
    if (entries.length) chains[marker.key] = entries;
  });

  return chains;
}

/** Normalise differing chain keys (BASE_MAINNET vs base) to a chain name. */
function chainName(key: string) {
  const k = key.toUpperCase().replace(/_/g, "");
  if (k.includes("SEPOLIA")) return "baseSepolia";
  if (k.includes("LOCAL")) return "local";
  if (k.includes("BASE")) return "base";
  return k.toLowerCase();
}

describe("token registries stay in sync", () => {
  const backend = parseTokens(backendTokens);
  const frontend = parseTokens(frontendTokens);

  const byChain = (parsed: ReturnType<typeof parseTokens>) => {
    const out: Record<string, (typeof parsed)[string]> = {};
    for (const [key, tokens] of Object.entries(parsed)) out[chainName(key)] = tokens;
    return out;
  };

  const be = byChain(backend);
  const fe = byChain(frontend);

  it("parsed something from both files", () => {
    // Guards the test itself: a regex that silently matches nothing would
    // make every assertion below trivially true.
    assert.ok(Object.keys(be).length > 0, "no chains parsed from the backend registry");
    assert.ok(Object.keys(fe).length > 0, "no chains parsed from the frontend registry");
    assert.ok((be.base?.length ?? 0) >= 2, "expected several Base mainnet tokens in the backend");
  });

  for (const chain of ["base", "baseSepolia"]) {
    it(`offers the same symbols on ${chain}`, () => {
      const beSymbols = (be[chain] ?? []).map((t) => t.symbol).sort();
      const feSymbols = (fe[chain] ?? []).map((t) => t.symbol).sort();
      assert.deepEqual(
        feSymbols,
        beSymbols,
        `the UI offers [${feSymbols}] but the API accepts [${beSymbols}] on ${chain}`,
      );
    });

    it(`agrees on every address and decimals on ${chain}`, () => {
      for (const feToken of fe[chain] ?? []) {
        const beToken = (be[chain] ?? []).find((t) => t.symbol === feToken.symbol);
        assert.ok(beToken, `${feToken.symbol} is offered by the UI but unknown to the API`);
        assert.equal(
          feToken.address,
          beToken.address,
          `${feToken.symbol} address differs — the stake would go somewhere the API does not check`,
        );
        assert.equal(
          feToken.decimals,
          beToken.decimals,
          `${feToken.symbol} decimals differ — every amount would be misread by a factor of ten`,
        );
      }
    });
  }
});
