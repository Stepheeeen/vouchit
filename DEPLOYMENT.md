# Vouchit — deployment runbook

Vouchit is **non-custodial**. Stakes live in the `VouchitEscrow` contract, never
in a Vouchit balance. There is no ledger, no deposits, no withdrawals. The
backend records and mirrors what the chain does; it never moves money.

That shapes everything below: the risky asset is not a database, it is the
relayer key and the contract itself.

---

## 0. What is already deployed

**Base mainnet (chain 8453) — live as of 2026-11-10.**

| | |
|---|---|
| `VouchitEscrow` | [`0xc75633c19c5855A5DdBC2589ee509B7202CEFD14`](https://basescan.org/address/0xc75633c19c5855A5DdBC2589ee509B7202CEFD14#code) — source verified |
| Owner / relayer | `0xbd1E5fD1e279A94791D96e4836E39fe08354f0F8` |
| Treasury | `0x710F25Fd6CC08CefFEE734C0d2ae1bB64eB04324` |
| Protocol fee | 250 bps (2.5%) |
| Preflight | 10/10 |

We went to mainnet without a Base Sepolia rehearsal because no faucet would
issue Sepolia ETH to a Nigerian-KYC account. Base gas is sub-cent, so the live
test below runs on mainnet with deliberately tiny stakes — which also exercises
the real Coinbase bundler and paymaster, something Sepolia only approximates.

The deployer key is the owner and the only address that can resolve a dispute.
It is a throwaway generated for this deployment and currently holds only gas.
§5 still applies before real volume: move ownership to a Safe multisig.

---

## 0b. Staging environment (live)

| | |
|---|---|
| Frontend | https://vouchit-git-web3-production-stepheeeen.vercel.app |
| API | https://vouchit-staging.onrender.com |
| Render service | `vouchit-staging` (`srv-dbpa7bgm7kps73aavfmg`), branch `web3-production`, free plan |
| Database | `vouchit_staging` on the production Atlas cluster — separate database, empty |
| Chain | Base **mainnet** (8453), escrow `0xc756…FD14` |

Verified live against it: `/wagers` and `/users/leaderboard` answer 200 with no
`password`/`otp`/`email` fields, `/users/me` and `/web3/verification` are 401
unauthenticated, a malformed user id is 404 rather than 500, CORS admits the
Vercel branch alias and rejects an unknown origin.

Vercel variables are scoped so Production is untouched: `NEXT_PUBLIC_CHAIN` and
`NEXT_PUBLIC_ESCROW_ADDRESS` on Preview, and `NEXT_PUBLIC_API_URL` scoped to the
`web3-production` **branch**, which overrides the broader Preview/Production
record without modifying it.

That branch scoping matters more than it looks. `API_BASE_URL` in
`frontend/src/lib/api.ts` falls back to `https://vouchit.onrender.com` — the
**production** API — whenever `NEXT_PUBLIC_API_URL` is unset. A preview missing
that variable does not fail loudly; it quietly drives the live naira backend. A
local build with the staging values confirmed the staging URL is inlined and the
fallback string is absent from the output entirely.

**Preview deployment protection is off**, so the URL is publicly reachable by
anyone who has it. That was a deliberate choice to let the client and early
testers in without Vercel accounts; it also means a real-money app sits on a
guessable URL. Turn it back on in Vercel → Settings → Deployment Protection
when the test window closes.

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

## 4. Live test on Base mainnet

Two browser profiles, two wallets, two people — with **real money**, so keep
stakes at the floor. Tier 0 allows 0.0002–0.01 ETH; 0.0002 ETH is roughly
$0.70. Each tester needs their own ETH on Base: `fund:testers` deliberately
refuses to run on mainnet, so it cannot help here.

- [ ] Sign in with a passkey, no extension and no seed phrase — **the one thing local testing cannot cover**
- [ ] Link the wallet; confirm it survives a reload and a second device
- [ ] Create a wager; the escrow transaction mines before the API records it
- [ ] Second account joins and matches the stake
- [ ] Both vote the same winner → the contract settles itself, winner paid less 2.5%
- [ ] Treasury increased by exactly the fee
- [ ] Conflicting votes → dispute → admin resolves → funds move on-chain
- [ ] A wager expires unjoined → creator refunded in full, no fee
- [ ] Tier limits bite: a fresh account cannot open a wager to anyone, or exceed its stake cap

The last item reads differently now: tier 0 may create open wagers (see the
comment on `TIER_LIMITS`), so what still bites is the 0.01 ETH stake ceiling and
the 3-wager concurrency limit. Confirm both, and confirm the ceiling is refused
*before* any gas is spent rather than after.

---

## 4b. Migrating a database that already has users

Prisma applies `@default(...)` when it **creates** a document, not when it
reads one. A `User` written before a field existed simply lacks it, and Prisma
then refuses to materialise the whole row:

```
Invalid `prisma.user.findUnique()` invocation
```

So the account becomes entirely unreadable, not merely missing a value. This
was confirmed against a real document, not assumed — a legacy-shaped `User`
was inserted into staging, failed to read, and read correctly after the
backfill below.

The staging database is empty, so it needs nothing. Any database that already
holds users does:

```bash
cd backend
npm run db:backfill          # report what is missing, change nothing
npm run db:backfill:apply    # write the defaults
```

It is safe to re-run: every update is conditional on the field being absent.
`sessionsValidFrom` is set per document from its own `createdAt`, so existing
sessions stay valid instead of everyone being signed out at once.

Keep `scripts/backfill-user-defaults.js` in step with the `User` model. A new
non-nullable column added to the schema without a matching entry there will
break reads of every older document in exactly the way above.

---

## 4c. Going live on usevouchit.com

Everything below is already configured. Merging `web3-production` into `main`
is the step that publishes, and it is a clean fast-forward.

**Services**

| | branch | auto-deploy | url |
|---|---|---|---|
| `vouchit-api` (production) | `main` | **off** | https://vouchit-api.onrender.com |
| `vouchit-staging` | `web3-production` | on | https://vouchit-staging.onrender.com |
| `vouchit` (old naira backend) | `main` | on | https://vouchit.onrender.com |

`vouchit-api` is a new service rather than a reconfiguration of `vouchit`,
for two reasons: the Render CLI cannot set environment variables on an
existing service, and leaving the old one untouched means the live site keeps
working until the moment you choose to cut over, with an obvious way back.

Its configuration was proved by pointing it at `web3-production`, deploying,
and running the API checks against it — 10/10, including CORS keyed to
`https://www.usevouchit.com` — then switching it back to `main`.

Auto-deploy is **off** on purpose. `main` still carries the old code, which
has `backend/scratch` and a `tsconfig.build.json` that does not exclude it, so
it emits `dist/src/main.js` and the `node dist/main.js` start command would
fail. The merge brings the fix; until then an automatic build would only
produce a red service.

**Database:** `vouchit_web3`, empty and separate. The old `vouchit` database
keeps the naira-era documents — its `Wager` rows have `amount`/`totalPot` as
Float where this code expects String, so `GET /wagers` would throw against it.
Nothing is deleted; it is simply not used.

**Vercel Production** is already pointed at the new backend:
`NEXT_PUBLIC_API_URL=https://vouchit-api.onrender.com`,
`NEXT_PUBLIC_CHAIN=base`, `NEXT_PUBLIC_ESCROW_ADDRESS=0xc756…FD14`. Setting
these did not redeploy anything; they apply to the next production build.

**The cutover**

```bash
git checkout main && git merge --ff-only web3-production && git push origin main
```

Then, in order:

1. Deploy `vouchit-api` (`render deploys create srv-dbptdfrrjlhs73b1vgbg --wait`),
   or switch its auto-deploy on and let the push trigger it.
2. Confirm `https://vouchit-api.onrender.com/wagers` answers 200.
3. Confirm https://www.usevouchit.com serves the new build — the landing page
   should no longer mention Paystack.
4. Turn auto-deploy on for `vouchit-api` if you have not already.
5. Suspend the old `vouchit` service once you are satisfied. Keep it suspended
   rather than deleted for a while; it is the rollback.

**Rolling back** means pointing `NEXT_PUBLIC_API_URL` back at the old service
and reverting the merge. Nothing in the escrow contract is affected either
way — it holds real money independently of which web server is running.

---

## 5. Before mainnet

- [ ] **Decide how the relayer key is held.** It owns the contract and is the
      only address that can resolve a dispute — whoever holds it can settle any
      dispute in their own favour. Best to worst: deploy from a hardware wallet
      then `setOwner` to a Safe multisig; a dedicated hot key holding only gas;
      a KMS signer. Generate a fresh key; do not promote the testnet one.
- [ ] Re-run the security review over the final diff.
- [ ] Consider a third-party audit of `VouchitEscrow.sol` before real volume.
- [ ] **Etherscan plan — confirmed, not predicted.** Called live against the
      V2 API with the project key: chain 84532 answers normally, chain 8453
      answers `"Free API access is not supported for this chain"`. So on mainnet
      wallet age is permanently unavailable, the attestation reader is stubbed,
      and the only route out of NEWCOMER is 5 settled wagers across 3 distinct
      opponents. Tier 0 was therefore opened to open wagers so accounts can
      reach that record at all. Buying a paid plan restores wallet-age promotion
      and lets the open-wager gate go back to being a real gate.
- [x] **Tier-0 defaults settled.** NEWCOMER: open wagers allowed, 3 concurrent,
      0.01 ETH / 25 USDC ceiling. Revisit the open-wager permission the moment a
      promotion signal actually works.
- [x] **Naira is gone from the code.** The ledger, Wallet, LedgerEntry and
      Transaction models went earlier; the last remnants — the `BankAccount`
      model, its relation on `User`, and `PAYSTACK_SECRET_KEY` — are now
      removed too, along with the landing copy that still advertised Paystack.
      There is no fiat path and no bank detail stored anywhere.
- [ ] Decide the fate of the **old production database**, which still holds
      naira-era documents. Do not point this build at it without reading
      "Migrating a database that already has users" below.
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
