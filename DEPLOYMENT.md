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
npm run node          # terminal 1 — local chain
npm run verify:all    # terminal 2 — unit tests, e2e lifecycle, ABI compatibility
```

Three layers, all offline:

| Command | Proves |
|---|---|
| `npm test` | 31 unit tests: create/join/vote/settle/dispute/cancel, native + ERC20, fee math, no dust left in the contract |
| `npm run e2e` | The whole lifecycle on a live chain with separate signers, asserting real balance deltas net of gas |
| `npm run abi-compat` | The hand-written ABIs in the backend and frontend actually decode the deployed contract |

`abi-compat` exists because both apps hand-write their ABI instead of importing
build artifacts. A drifted signature typechecks fine and fails at runtime, in
production, while money is moving.

**What local testing cannot prove:** Coinbase Smart Wallet passkey login needs
Coinbase's bundler and paymaster, which have no localhost equivalent. The wallet
flow must be confirmed on Base Sepolia before mainnet.

---

## 2. Deploy to Base Sepolia

Costs nothing. Sepolia is Base's test network, not a vendor — no signup.

1. **Treasury address** — any wallet you control; receives the 2.5% fee. No
   private key is ever needed for it; the contract only sends to it.
2. **Deployer/relayer key** — a fresh throwaway for Sepolia. It becomes the
   contract `owner` and is the only address that can resolve disputes.
3. Fund the deployer from a Base Sepolia faucet.
4. Set `TREASURY_ADDRESS` and `ADMIN_RELAYER_PRIVATE_KEY` in `backend/.env`.

```bash
cd contracts && npm run deploy:sepolia
```

The script refuses to run without a valid treasury address or with an unfunded
deployer, rather than half-deploying.

Then set the printed address in **both** apps:

- `backend/.env` → `VOUCHIT_ESCROW_CONTRACT_ADDRESS`
- `frontend/.env.local` → `NEXT_PUBLIC_ESCROW_ADDRESS`

They must match. If the frontend escrows into one contract and the backend
verifies against another, every wager is rejected after the user has already
paid gas.

---

## 3. Live test on Sepolia

Run the loop with two real browser profiles and two wallets:

- [ ] Sign in with a passkey (no extension, no seed phrase) — **the thing local testing cannot cover**
- [ ] Link the wallet; confirm it persists across a reload
- [ ] Create a wager; confirm the escrow tx mines before the API records it
- [ ] Second account joins and matches the stake
- [ ] Both vote the same winner → contract self-settles, winner paid less 2.5%
- [ ] Treasury balance increased by exactly the fee
- [ ] Conflicting votes → dispute; admin resolves; funds move on-chain
- [ ] Let a wager expire unjoined → creator refunds in full, no fee
- [ ] Tier limits bite: a fresh account is blocked from open wagers and from
      exceeding the tier-0 stake cap

---

## 4. Before mainnet

- [ ] **Security review of the money path.** Nothing here has been reviewed yet.
- [ ] Decide the relayer key posture. It can resolve any dispute in its own
      favour. Best to worst: deploy from a hardware wallet then `setOwner` to a
      Safe multisig; a dedicated hot key holding only gas; a KMS/HSM signer.
- [ ] Consider a third-party audit of `VouchitEscrow.sol` before real volume.
- [ ] Set `BASESCAN_API_KEY`, or every account stays at tier 0 forever.
- [ ] Confirm `minPoolSize=3` is on the production `DATABASE_URL`.

## 5. Go to mainnet

```bash
cd contracts && npm run deploy:mainnet
```

Then flip, in this order — backend first, so the API never validates against a
contract the frontend isn't using yet:

| Variable | Value |
|---|---|
| `WEB3_CHAIN_ID` | `8453` |
| `WEB3_RPC_URL` | mainnet RPC |
| `VOUCHIT_ESCROW_CONTRACT_ADDRESS` | mainnet address |
| `NEXT_PUBLIC_CHAIN` | `base` |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | mainnet address |

Both apps default to Base Sepolia when unset, so a missed variable fails safe
rather than pointing at real funds.

Start with small real amounts before announcing anything.
