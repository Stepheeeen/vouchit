/**
 * The rules that decide whether we tell a user their gas is covered.
 *
 * Getting this wrong is worse than not offering sponsorship at all: the UI
 * drops the "you need ETH" warning, the user arrives with an empty wallet,
 * and their own wallet rejects the call. So the decision is pinned here in
 * isolation from React, rather than being trusted to a `useMemo` nobody can
 * exercise.
 *
 * Mirrors the logic in useSponsoredCalls.ts.
 *
 * Runs on Node's built-in test runner (`npm run test:unit`) so the frontend
 * gains a place for pure-logic tests without taking on a test framework.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decideSponsorship, type ChainCapabilities } from "./sponsorship.ts";

describe("sponsorship decision", () => {
  const smartWallet: ChainCapabilities = {
    paymasterService: { supported: true },
    atomic: { status: "supported" },
  };
  // A browser extension wallet reports neither.
  const extensionWallet: ChainCapabilities = {};

  it("sponsors a smart wallet when a paymaster is configured", () => {
    const { isSponsored, canBatch } = decideSponsorship("https://paymaster.example", smartWallet);
    assert.equal(isSponsored, true);
    assert.equal(canBatch, true);
  });

  it("does not claim sponsorship without a paymaster, however capable the wallet", () => {
    // The wallet could accept one; we have nothing to give it.
    const { isSponsored, canBatch } = decideSponsorship(undefined, smartWallet);
    assert.equal(isSponsored, false);
    // Batching still works and is still worth doing — one prompt instead of
    // two, even when the user pays their own gas.
    assert.equal(canBatch, true);
  });

  it("does not claim sponsorship for an extension wallet even with a paymaster", () => {
    // The dangerous case. A key-pair account cannot be sponsored, so
    // advertising it would hide the ETH requirement from exactly the users
    // who still have it.
    const { isSponsored, canBatch } = decideSponsorship("https://paymaster.example", extensionWallet);
    assert.equal(isSponsored, false);
    assert.equal(canBatch, false);
  });

  it("treats an unknown wallet as unsponsored rather than assuming", () => {
    const { isSponsored, canBatch } = decideSponsorship("https://paymaster.example", undefined);
    assert.equal(isSponsored, false);
    assert.equal(canBatch, false);
  });

  it("does not sponsor when the wallet explicitly reports no paymaster support", () => {
    const declining: ChainCapabilities = {
      paymasterService: { supported: false },
      atomic: { status: "supported" },
    };
    assert.equal(decideSponsorship("https://paymaster.example", declining).isSponsored, false);
  });

  it("accepts either spelling of atomic batching", () => {
    // Wallets have shipped both shapes as EIP-5792 settled.
    assert.equal(decideSponsorship(undefined, { atomic: { status: "ready" } }).canBatch, true);
    assert.equal(decideSponsorship(undefined, { atomicBatch: { supported: true } }).canBatch, true);
  });
});
