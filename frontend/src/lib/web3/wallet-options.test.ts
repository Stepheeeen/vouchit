import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWalletOptions, classifyConnector } from "./wallet-options.ts";

describe("wallet picker options", () => {
  const coinbase = { id: "coinbaseWalletSDK", name: "Coinbase Wallet" };
  const wc = { id: "walletConnect", name: "WalletConnect" };
  const injected = { id: "injected", name: "MetaMask" };

  it("classifies each connector by what it reports", () => {
    assert.equal(classifyConnector(coinbase), "passkey");
    assert.equal(classifyConnector(wc), "mobile");
    assert.equal(classifyConnector(injected), "extension");
  });

  it("leads with the passkey route, which is the one a newcomer should take", () => {
    const options = buildWalletOptions([injected, wc, coinbase]);
    assert.deepEqual(
      options.map((o) => o.kind),
      ["passkey", "mobile", "extension"],
    );
  });

  it("lists only what is configured", () => {
    // WalletConnect is omitted from the wagmi config when no project id is
    // set, so it must not appear — a button that fails on tap is worse than
    // no button.
    const options = buildWalletOptions([coinbase, injected]);
    assert.equal(options.length, 2);
    assert.ok(!options.some((o) => o.kind === "mobile"));
  });

  it("does not mislabel an unfamiliar connector as a mobile one", () => {
    // Defaulting to "extension" means the worst case is telling a desktop
    // user to use an extension, not telling a phone user to scan a QR code
    // that will never appear.
    assert.equal(classifyConnector({ id: "rabby", name: "Rabby Wallet" }), "extension");
    assert.equal(classifyConnector({ id: "safe", name: "Safe" }), "extension");
  });

  it("recognises a Coinbase connector under either naming", () => {
    assert.equal(classifyConnector({ id: "coinbaseWallet", name: "Coinbase" }), "passkey");
    assert.equal(classifyConnector({ id: "smartWallet", name: "Smart Wallet" }), "passkey");
  });
});
