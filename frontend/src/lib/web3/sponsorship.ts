/**
 * Whether to tell a user their network fee is covered, and whether their
 * wallet can take several calls in one prompt.
 *
 * Kept out of the React hook deliberately. Getting it wrong is worse than not
 * offering sponsorship at all — the UI drops the "you need ETH" warning, the
 * user arrives with an empty wallet, and their own wallet rejects the call —
 * so the decision lives in a plain function that can be exercised directly
 * rather than inside a `useMemo` nothing can reach.
 */

/** One chain's entry in a wallet's EIP-5792 capability report. */
export interface ChainCapabilities {
  paymasterService?: { supported?: boolean };
  atomic?: { status?: string };
  atomicBatch?: { supported?: boolean };
}

export function decideSponsorship(
  paymasterUrl: string | undefined,
  chainCapabilities: ChainCapabilities | undefined,
) {
  // A configured paymaster is necessary but not sufficient: only a smart
  // account can accept one. An extension wallet is a key pair, pays its own
  // gas, and must keep seeing the ETH requirement.
  const isSponsored = !!paymasterUrl && chainCapabilities?.paymasterService?.supported === true;

  // Batching is worth doing even unsponsored — one prompt instead of two.
  // Both spellings appear in the wild as EIP-5792 settled.
  const canBatch =
    chainCapabilities?.atomic?.status === "supported" ||
    chainCapabilities?.atomic?.status === "ready" ||
    chainCapabilities?.atomicBatch?.supported === true;

  return { isSponsored, canBatch };
}
