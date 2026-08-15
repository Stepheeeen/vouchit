# Web3-first overhaul — handoff notes

Full backlog from the product owner (18 items: session bugs, wallet UX, funding model, withdrawal-limit/verification policy, web2 sunset, profile/social, data export, hardening + prod push). This got broken into 8 phases after auditing the actual code (not just the feature requests at face value — a few of them turned out to be different bugs than they sounded like). Full phase-by-phase plan lives in this file; only **Phase 1 is done**. Everything below Phase 1 is still open.

## Decisions already made (don't re-litigate these)
- **Chain: Base** (mainnet later; use Base Sepolia for all testing first).
- **Image storage: Cloudinary** (already used elsewhere in this repo for dispute evidence uploads — see `disputesApi.uploadFile` in `frontend/src/lib/api.ts`).
- **No-ID withdrawal-limit verification path**: instead of requiring BVN/NIN (govt ID), the alternate path to the uncapped tier is *verified email + signature-linked web3 wallet + on-chain wallet reputation* (wallet age / tx history threshold). This was a deliberate product choice — the user explicitly rejected selfie/liveness and rejected pure tiered-cooldown-only approaches.

## Corrected assumptions (read before touching auth/wallet code)
Two of the original bug reports were **not what they sounded like** once traced through the code:
1. **"Login again on every new tab"** — the JWT was already stored in a cross-tab cookie + localStorage, not per-tab state. Not a storage-architecture bug. Root cause is unconfirmed (possibly already fine, possibly a browser-specific cookie policy issue) — see Phase 1 notes below for what was hardened defensively.
2. **"No withdrawal limit today"** — there was never an enforced cap in code, only a flat ₦1,000 floor in `ledger.service.ts`. "Remove the limit" therefore means: introduce real tiered caps for the first time, then give the no-ID path described above to reach the uncapped tier.

Also found: `Wallet.cryptoAvailableBalance` / `cryptoEscrowBalance` in the Prisma schema are **completely dead fields** — no code anywhere credits or debits them yet. The "fund from web3 wallet" / "coin+chain options" asks are net-new subsystems, not fixes to something broken.

---

## Phase 1 — Auth/session/wallet-reconnect fixes — ✅ DONE

- `frontend/src/lib/api.ts`: `fetchApi` no longer sends `Content-Type: application/json` on requests with no body — it was forcing a CORS preflight `OPTIONS` round-trip on every GET, including the 10-second notification poll in `AppNav.tsx`. Added shared `setAuthToken()`/`clearAuthToken()` helpers (explicit `sameSite: 'Lax'`, `secure` in prod) so login/verify/logout don't each re-implement cookie handling.
- `frontend/src/app/auth/login/page.tsx`, `.../auth/verify/page.tsx`, `frontend/src/app/settings/page.tsx`: now call the shared helpers instead of duplicating `Cookies.set`/`localStorage`.
- `frontend/src/components/layout/AppNav.tsx`: the wallet-connect badge now reads `user.web3Address` (the backend-linked wallet, persists across reload) instead of only `Web3Context`'s live `isConnected` (which only reflects the injected provider's current in-browser permission — this was the actual cause of "wallet needs reconnect on reload," a UI state bug, not a missing-persistence bug).
- **Security fix found as a drive-by**: `backend/src/users/users.service.ts`'s `findById()` (backing `GET /users/me`) was returning the full Prisma `User` row — **including the bcrypt password hash and OTP** — to the browser on every profile load, unfiltered. Now strips `password`/`otp`/`otpExpiresAt` before returning.
- **Still open from Phase 1**: verify in the Render dashboard that `DATABASE_URL` actually has `minPoolSize` set (referenced in an earlier perf commit, but lives in a git-ignored `.env` so it couldn't be confirmed from the repo). Also worth reproducing the "new tab" login issue live in two tabs against the real deployed origins now that cookie attributes are explicit, to confirm whether it's actually fixed.
- Verified: `npx tsc --noEmit` clean on both frontend/backend, `npx eslint` clean on changed files. Two Jest suites (`users.service.spec.ts`, `auth.service.spec.ts`) fail with a NestJS DI error in their `TestingModule` setup — **confirmed pre-existing on `main` before this change** (not caused by this work), needs separate attention.

## Phase 2 — Wallet UX: multi-device connect + clearer web3 flow — not started

- Add WalletConnect (via `wagmi` + a WalletConnect/Reown connector) alongside the raw `window.ethereum` injection in `frontend/src/context/Web3Context.tsx`, so mobile users can connect via QR/deep link.
- Consolidate wallet UI (`frontend/src/app/wallet/page.tsx` + the `AppNav` connect button) into one panel that clearly explains web3 (on-chain escrow) vs custodial (internal `availableBalance`) wager funding.

## Phase 3 — Web2 sunset — not started

- Remove `phone`/SMS entirely. Full reference list already collected: `backend/prisma/schema.prisma` (`phone` field), `backend/src/users/users.service.ts` + `users.controller.ts` (`updateMe`), `frontend/src/lib/api.ts` (`updateProfile` type), `frontend/src/app/settings/page.tsx` (phone input, SMS-alerts label, `notifSMS` toggle), `frontend/src/app/auth/login/page.tsx` (disabled "Phone Login (Coming Soon)" button).
- Hide the custodial-only wager-funding path once its web3 equivalent (Phase 4) is solid — don't delete the ledger, it stays as the accounting backbone for both fiat and crypto balances.

## Phase 4 — Wallet funding/debit model — not started, needs credentials

Biggest phase. **Blocked on**: a Base RPC URL/API key, a treasury/relayer wallet private key, and the Cloudinary account being wired server-side (frontend already has a working Cloudinary upload pattern to copy — `disputesApi.uploadFile`).

- Real crypto deposit crediting mirroring the existing Paystack pattern in `backend/src/ledger/ledger.service.ts` (`initializeDeposit`/`verifyDeposit`): submit tx hash, verify via `ethers`/`viem`, credit `Wallet.cryptoAvailableBalance`.
- **Known bug to fix here, not separately**: `frontend/src/app/vouch/create/page.tsx` (~line 85-91) — the "Web3 On-Chain" funding option submits `isWeb3: true` but fabricates a fake contract address client-side (`` `0xcontract_${Date.now()}` ``) instead of using the real connected wallet from `useWeb3()`.
- `backend/src/wagers/wagers.service.ts` trusts a client-supplied `contractWagerId` with no on-chain check for web3 wagers — verify against the deployed `VouchitEscrow.wagers(wagerId)` view before marking funded.
- New crypto-withdrawal-to-external-address endpoint alongside `processWithdrawal` in `ledger.service.ts`.
- Deploy `contracts/VouchitEscrow.sol` to Base Sepolia, then Base mainnet. `render.yaml` currently has **no** `VOUCHIT_ESCROW_CONTRACT_ADDRESS`/`WEB3_RPC_URL`/`ADMIN_RELAYER_PRIVATE_KEY` at all — needs adding once deployed.
- Start coin/chain support with Base native ETH + USDC, as a config list (contract already models `address(0)` native vs ERC20).

## Phase 5 — Withdrawal limit removal + no-ID verification — not started

- Enforce tiered caps in `ledger.service.ts`'s `processWithdrawal` (none exist today beyond the ₦1,000 floor).
- Second path to the uncapped tier (alongside existing BVN/NIN in `users.service.ts`'s `verifyKYC`): `emailVerified === true` + signature-verified `web3Address` (already implemented in `web3.service.ts`'s `linkWallet`) + on-chain reputation check. Store next to `kycTier` (e.g. new `verificationMethod` field) for auditability.

## Phase 6 — Profile & social — not started

- `GET /users/:id` (public-safe fields only — never email/phone/kycTier) + `frontend/src/app/profile/[id]/page.tsx`. Only `GET /users/me` exists today.
- Picture upload is fully greenfield: no `avatarUrl` field on `User`, no upload endpoint, the settings-page "Upload new photo" button (`frontend/src/app/settings/page.tsx` ~line 333) has no handler at all. Reuse the working `disputesApi.uploadFile` Cloudinary pattern.
- "Share Profile" button (`frontend/src/app/profile/page.tsx` ~line 152) is decorative — wire to `navigator.share`/copy-link, copying `handleShare` from `frontend/src/app/vouch/[id]/invite/page.tsx` (~line 41).

## Phase 7 — Export data — not started

- `GET /users/me/export` aggregating the user's `User`/`Wallet`/`LedgerEntry`/`Transaction`/`Wager`/`WagerParticipant`/`Dispute`/`Evidence`/`Notification` rows into a JSON download. Wire up the existing dead "Download My Data" button (`frontend/src/app/settings/page.tsx` ~line 674).

## Phase 8 — Hardening, live e2e test, prod push — not started

- Run the `security-review` skill against the full diff before shipping Phase 4/5 (money-movement + verification logic).
- Live end-to-end test on Base Sepolia first (connect → fund → create web3 wager → join → settle → payout → withdraw), then small real amounts on Base mainnet.
- Full manual pass over every original backlog item.
- Deploy phase-by-phase with explicit product-owner go-ahead each time — not one big-bang merge.

## Full audit reference

A complete dead-UI audit (every button/icon across both the user and admin platforms) was done before Phase 1 started. Only two extra dead elements turned up beyond what's listed in Phases 6/7 above ("Share Profile" and the fake-contract-address bug in `vouch/create`) — everything else in the app (dashboard, wallet modals, KYC modal, explore/leaderboard, all vouch flows, the admin disputes dashboard) is fully wired to real API calls. The admin platform currently has only one page (`/admin/disputes`) and no dead links, but also no settings/user-management/analytics surface — flagged in case that's wanted later, nothing in this plan currently requires it (Phase 5's verification path is fully automatic).
