/**
 * Minimal ABI surface of VouchitEscrow that the backend needs.
 * Kept hand-written (rather than importing build artifacts) so the API server
 * has no dependency on the contracts workspace being compiled.
 */
export const VOUCHIT_ESCROW_ABI = [
  'function wagers(bytes32) view returns (bytes32 wagerId, address creator, address challenger, address token, uint256 stakeAmount, uint256 totalPot, uint8 status, address winner, address creatorVote, address challengerVote, uint256 expiresAt)',
  'function resolveDispute(bytes32 wagerId, address winner, uint8 resolutionType) external',
] as const;

/** Mirrors the WagerStatus enum in VouchitEscrow.sol. */
export enum OnChainWagerStatus {
  PENDING_FUNDING = 0,
  ACTIVE = 1,
  SETTLED = 2,
  DISPUTED = 3,
  CANCELLED = 4,
}
