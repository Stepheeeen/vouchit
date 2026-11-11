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

describe("duplicate connectors", () => {
  // wagmi lists the configured injected() connector AND every wallet that
  // announces itself via EIP-6963. With only MetaMask installed that is two
  // connectors for one wallet, and the picker showed two identical
  // "Use a browser wallet" buttons.
  const configuredInjected = { id: "injected", name: "Injected" };
  const discoveredMetaMask = { id: "io.metamask", name: "MetaMask" };

  it("shows one entry when two connectors mean the same wallet", () => {
    const options = buildWalletOptions([configuredInjected, discoveredMetaMask]);
    assert.equal(options.filter((o) => o.kind === "extension").length, 1);
  });

  it("keeps the one that names the wallet", () => {
    // "MetaMask" tells someone what will open; "Injected" does not.
    const options = buildWalletOptions([configuredInjected, discoveredMetaMask]);
    assert.equal(options.find((o) => o.kind === "extension")?.name, "MetaMask");
  });

  it("is order-independent", () => {
    const a = buildWalletOptions([configuredInjected, discoveredMetaMask]);
    const b = buildWalletOptions([discoveredMetaMask, configuredInjected]);
    assert.deepEqual(a, b);
  });

  it("still lists two genuinely different extensions", () => {
    const rabby = { id: "io.rabby", name: "Rabby Wallet" };
    const options = buildWalletOptions([discoveredMetaMask, rabby]);
    assert.equal(options.filter((o) => o.kind === "extension").length, 2);
  });

  it("collapses duplicate passkey or mobile connectors to one each", () => {
    const options = buildWalletOptions([
      { id: "coinbaseWalletSDK", name: "Coinbase Wallet" },
      { id: "coinbaseWallet", name: "Coinbase Smart Wallet" },
      { id: "walletConnect", name: "WalletConnect" },
    ]);
    assert.equal(options.filter((o) => o.kind === "passkey").length, 1);
    assert.equal(options.filter((o) => o.kind === "mobile").length, 1);
  });
});
