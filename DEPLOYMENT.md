# Vouchit — deployment runbook

Vouchit is **non-custodial**. Stakes live in the `VouchitEscrow` contract, never
in a Vouchit balance. There is no ledger, no deposits, no withdrawals. The
backend records and mirrors what the chain does; it never moves money.

That shapes everything below: the risky asset is not a database, it is the
relayer key and the contract itself.

---

## 1. Verify locally (no keys, no faucet, no accounts)

```bash
cd contracts
npm install && npx hardhat compile
npm test                 # 31 unit tests
npm run e2e              # full lifecycle on a live chain
npm run abi-compat       # backend + frontend ABIs vs the deployed contract

cd ../backend
npx jest --testPathIgnorePatterns "wager-lifecycle|auth-responses"   # unit
npm run test:integration # API + chain + MongoDB, with real signatures
```

| Layer | Proves |
|---|---|
| Contract unit (31) | create/join/vote/settle/dispute/cancel, native + ERC20, fee math, no dust left behind |
| Contract e2e (7 stages) | The lifecycle over real transactions, asserting balance deltas net of gas |
| ABI compatibility (24) | The hand-written ABIs in both apps actually decode the deployed contract |
| Backend unit (12) | Secret stripping, OTP replay refusal, malformed-id handling, controller delegation |
| Full-stack integration (6) | API and escrow agree: fabricated ids refused, another wallet's escrow unclaimable, one escrow cannot back two wagers, settlement mirrored from chain, tier ceiling enforced |
| Auth responses (4) | No `password`, `otp` or `otpExpiresAt` at any depth of any response; no email on public endpoints |

`abi-compat` exists because both apps hand-write their ABI instead of importing
build artifacts. A drifted signature typechecks fine and fails at runtime, in
production, while money is moving.

CI (`.github/workflows/ci.yml`) runs everything except the two integration
suites, which need a MongoDB replica set and are run locally.

**What local testing cannot prove:** Coinbase Smart Wallet passkey login needs
Coinbase's bundler and paymaster, which have no localhost equivalent. The wallet
flow must be confirmed on Base Sepolia before mainnet.

---

## 2. Deploy to Base Sepolia

1. **Treasury address** — any wallet you control; receives the 2.5% fee. No
   private key is ever needed for it; the contract only sends to it.
2. **Deployer/relayer key** — becomes the contract `owner` and is the only
   address that can resolve disputes. A throwaway is fine for Sepolia.
3. Fund the deployer with ~0.01 Base Sepolia ETH. Faucets that need no mainnet
   balance: `portal.cdp.coinbase.com/products/faucet` (choose **Base Sepolia**,
   not "Sepolia") or `console.optimism.io/faucet`. A transfer from anyone
   holding Base Sepolia ETH works just as well.

```bash
cd contracts && npm run deploy:sepolia
```

The script refuses to run without a valid treasury address or with an unfunded
deployer, rather than half-deploying.

Set the printed address in **both** apps:

- `backend/.env` → `VOUCHIT_ESCROW_CONTRACT_ADDRESS`
- `frontend/.env.local` → `NEXT_PUBLIC_ESCROW_ADDRESS`

They must match. If the frontend escrows into one contract and the backend
verifies against another, every wager is rejected after the user has paid gas.

Then:

```bash
npm run preflight:sepolia
```

This checks what typechecks fine and fails with money on the line: that a
contract really exists at the configured address, that it answers the
`VouchitEscrow` interface, that the relayer key owns it (nothing else can
resolve a dispute), that the on-chain treasury is the one you configured, that
the fee is the 2.5% the UI promises, and that the relayer holds gas.

---

## 3. Staging environment

Put the test build on its own URL. Anyone landing on usevouchit.com should not
find an app wagering fake money.

**Render** — a new web service, branch `web3-production`, root `backend`:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Render's **Generate** button. Not production's. |
| `DATABASE_URL` | Production URI with `/vouchit?` changed to `/vouchit_staging?` |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Same as production |
| `FRONTEND_URL` | The Vercel branch URL (CORS is keyed off this) |
| `WEB3_CHAIN_ID` | `84532` |
| `WEB3_RPC_URL` | `https://sepolia.base.org` |
| `VOUCHIT_ESCROW_CONTRACT_ADDRESS` | From step 2 |
| `ADMIN_RELAYER_PRIVATE_KEY` | Paste from `backend/.env`; never through chat |
| `TREASURY_ADDRESS` | The treasury |
| `BASESCAN_API_KEY` | Etherscan key (see §5) |

A separate database name settles the migration question at no cost: same
cluster, empty database. **The old wager documents are the wrong shape for this
code** — `totalPot` and `amount` changed from `Float` to `String`, and
`tokenSymbol` / `tokenDecimals` / `onChainStake` are new and required — so
pointing staging at the production database makes `GET /wagers` throw.

**Vercel** — environment variables scoped to **Preview only**, never Production:
`NEXT_PUBLIC_API_URL` (the Render staging URL), `NEXT_PUBLIC_CHAIN=baseSepolia`,
`NEXT_PUBLIC_ESCROW_ADDRESS`, and the two Cloudinary values. Use the stable
branch URL, not the per-deploy hash.

Two ways this goes wrong: setting those on Vercel's **Production** scope, or
merging `web3-production` into `main`. Either puts the testnet app on the live
domain.

The free Render plan sleeps when idle — the first request after a quiet spell
takes ~50 seconds, which testers read as "broken".

---

## 4. Live test on Sepolia

Two browser profiles, two wallets, two people.

- [ ] Sign in with a passkey, no extension and no seed phrase — **the one thing local testing cannot cover**
- [ ] Link the wallet; confirm it survives a reload and a second device
- [ ] Create a wager; the escrow transaction mines before the API records it
- [ ] Second account joins and matches the stake
- [ ] Both vote the same winner → the contract settles itself, winner paid less 2.5%
- [ ] Treasury increased by exactly the fee
- [ ] Conflicting votes → dispute → admin resolves → funds move on-chain
- [ ] A wager expires unjoined → creator refunded in full, no fee
- [ ] Tier limits bite: a fresh account cannot open a wager to anyone, or exceed its stake cap

Fund testers with `npm run fund:testers` (addresses in `contracts/testers.txt`
or `TESTER_ADDRESSES`). It refuses to run on mainnet, skips the already-funded,
and prices the run before sending so it cannot half-fund a group.

---

## 5. Before mainnet

- [ ] **Decide how the relayer key is held.** It owns the contract and is the
      only address that can resolve a dispute — whoever holds it can settle any
      dispute in their own favour. Best to worst: deploy from a hardware wallet
      then `setOwner` to a Safe multisig; a dedicated hot key holding only gas;
      a KMS signer. Generate a fresh key; do not promote the testnet one.
- [ ] Re-run the security review over the final diff.
- [ ] Consider a third-party audit of `VouchitEscrow.sol` before real volume.
- [ ] **Etherscan plan.** Wallet-age tiering uses the V2 unified API. The free
      tier covers Base Sepolia (84532) but **not** Base mainnet (8453), which
      answers "Free API access is not supported for this chain". Without a paid
      plan the signal reports unavailable and tier 1 is unreachable by wallet
      age — leaving every account at tier 0 (invite-only, smallest cap)
      indefinitely, since the Coinbase attestation reader is still stubbed and
      the settlement route needs 5 settled wagers across 3 distinct opponents.
- [ ] Settle the **tier-0 defaults**. Whatever the plan, the starting tier has
      to be usable on day one.
- [ ] Decide the fate of the old production database and the naira app.
- [ ] Confirm the treasury wallet is one you can actually open. Fees are
      irreversible, and an address pasted without its checksum hides a typo.

## 6. Go to mainnet

```bash
cd contracts && npm run deploy:mainnet
npm run preflight:mainnet
```

Then flip, backend first so the API never validates against a contract the
frontend is not yet using:

| Variable | Value |
|---|---|
| `WEB3_CHAIN_ID` | `8453` |
| `WEB3_RPC_URL` | mainnet RPC |
| `VOUCHIT_ESCROW_CONTRACT_ADDRESS` | mainnet address |
| `NEXT_PUBLIC_CHAIN` | `base` |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | mainnet address |

Both apps default to Base Sepolia when unset, so a missed variable fails safe
rather than pointing at real funds.

Merging `web3-production` into `main` is what publishes to usevouchit.com. Do it
last, and start with small real amounts before announcing anything.
