/** ABI surface of VouchitEscrow used by the client. Mirrors contracts/src/VouchitEscrow.sol. */
export const escrowAbi = [
  {
    type: "function",
    name: "createWager",
    stateMutability: "payable",
    inputs: [
      { name: "wagerId", type: "bytes32" },
      { name: "challenger", type: "address" },
      { name: "token", type: "address" },
      { name: "stakeAmount", type: "uint256" },
      { name: "durationSeconds", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "joinWager",
    stateMutability: "payable",
    inputs: [{ name: "wagerId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "voteWinner",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wagerId", type: "bytes32" },
      { name: "votedWinner", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "openDispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "wagerId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelExpiredWager",
    stateMutability: "nonpayable",
    inputs: [{ name: "wagerId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "wagers",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "wagerId", type: "bytes32" },
      { name: "creator", type: "address" },
      { name: "challenger", type: "address" },
      { name: "token", type: "address" },
      { name: "stakeAmount", type: "uint256" },
      { name: "totalPot", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "winner", type: "address" },
      { name: "creatorVote", type: "address" },
      { name: "challengerVote", type: "address" },
      { name: "expiresAt", type: "uint256" },
    ],
  },
] as const;

/** Minimal ERC20 surface needed to approve a stake before createWager/joinWager. */
export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export enum OnChainWagerStatus {
  PENDING_FUNDING = 0,
  ACTIVE = 1,
  SETTLED = 2,
  DISPUTED = 3,
  CANCELLED = 4,
}
