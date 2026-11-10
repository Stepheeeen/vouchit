#!/usr/bin/env bash
#
# Boots the whole stack locally and exercises it over HTTP.
#
# Everything else we test goes through Jest and supertest, which never starts
# the servers that actually get deployed. This boots them — a local chain with
# the escrow deployed on it, a MongoDB replica set, the Nest API, and the
# production Next build — then drives real requests through the running API and
# fetches every page. It catches what in-process tests cannot: missing runtime
# env handling, SSR crashes, CORS, and route collisions.
#
#   ./scripts/smoke.sh
#
# Ports are deliberately offset from the defaults so a running dev environment
# is left alone.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/vouchit-smoke-$$"
CHAIN_PORT=8547
MONGO_PORT=27079
API_PORT=4100
WEB_PORT=3100
REPL_SET=smoke

mkdir -p "$WORK"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

cleanup() {
  step "Shutting down"
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null; done
  pkill -f "hardhat node --port $CHAIN_PORT" 2>/dev/null
  pkill -f "dbpath $WORK/mongo" 2>/dev/null
  if [ "${FAIL:-0}" -gt 0 ]; then
    echo "  logs kept in $WORK"
  else
    rm -rf "$WORK"
  fi
  echo "  done"
}
trap cleanup EXIT

PIDS=()

# ---------------------------------------------------------------- local chain
step "Local chain"
(cd "$ROOT/contracts" && ./node_modules/.bin/hardhat node --port "$CHAIN_PORT" \
  > "$WORK/chain.log" 2>&1) &
PIDS+=($!)

for _ in $(seq 1 60); do
  curl -sf -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    "http://127.0.0.1:$CHAIN_PORT" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf -X POST -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  "http://127.0.0.1:$CHAIN_PORT" >/dev/null 2>&1 \
  && pass "chain accepting RPC on $CHAIN_PORT" \
  || { fail "chain never started (see $WORK/chain.log)"; exit 1; }

ESCROW=$(cd "$ROOT/contracts" && CHAIN_PORT=$CHAIN_PORT node -e '
const { JsonRpcProvider, Wallet, ContractFactory } = require("ethers");
const fs = require("fs");
(async () => {
  const p = new JsonRpcProvider("http://127.0.0.1:" + process.env.CHAIN_PORT, undefined,
    { staticNetwork: true, cacheTimeout: -1 });
  // Hardhat account #0 owns the escrow; #1 is the treasury. Public dev keys.
  const owner = new Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", p);
  const a = JSON.parse(fs.readFileSync("artifacts/src/VouchitEscrow.sol/VouchitEscrow.json", "utf8"));
  const c = await new ContractFactory(a.abi, a.bytecode, owner).deploy("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  await c.waitForDeployment();
  process.stdout.write(await c.getAddress());
})();
')
[ -n "$ESCROW" ] && pass "escrow deployed at $ESCROW" || { fail "escrow deploy failed"; exit 1; }

# -------------------------------------------------------------------- mongodb
step "Database"
# mongodb-memory-server has cached the binary in both of these across versions.
MONGOD=$(ls "$ROOT"/backend/node_modules/.cache/mongodb-memory-server/mongod* \
            "$HOME"/.cache/mongodb-binaries/mongod* 2>/dev/null | head -1)
if [ -z "$MONGOD" ]; then
  fail "no mongod binary cached — run 'npm run mongo:fetch' in backend first"
  exit 1
fi

mkdir -p "$WORK/mongo"
"$MONGOD" --dbpath "$WORK/mongo" --port "$MONGO_PORT" --replSet "$REPL_SET" \
  --bind_ip 127.0.0.1 > "$WORK/mongo.log" 2>&1 &
PIDS+=($!)

(cd "$ROOT/backend" && MONGO_PORT=$MONGO_PORT REPL_SET=$REPL_SET node -e '
const { MongoClient } = require("mongodb");
const uri = "mongodb://127.0.0.1:" + process.env.MONGO_PORT + "/?directConnection=true";
(async () => {
  // Cold mongod startup was measured at 23s to first connection and 32s to a
  // primary on a loaded macOS machine, so a tight budget here fails on a server
  // that is merely slow. ~180 attempts of roughly a second each.
  for (let i = 0; i < 180; i++) {
    try {
      const c = new MongoClient(uri, { serverSelectionTimeoutMS: 500 });
      await c.connect();
      try {
        await c.db("admin").command({ replSetInitiate: {
          _id: process.env.REPL_SET,
          members: [{ _id: 0, host: "127.0.0.1:" + process.env.MONGO_PORT }],
        }});
      } catch (e) { if (!/already initialized/i.test(e.message)) throw e; }
      for (let j = 0; j < 240; j++) {
        if ((await c.db("admin").command({ hello: 1 })).isWritablePrimary) { await c.close(); return; }
        await new Promise(r => setTimeout(r, 250));
      }
      await c.close();
      throw new Error("no primary elected");
    } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  process.exit(1);
})();
') && pass "replica set primary on $MONGO_PORT" || { fail "mongod never became primary"; exit 1; }

# ------------------------------------------------------------------------ api
step "API"
(cd "$ROOT/backend" && \
  NODE_ENV=production \
  PORT=$API_PORT \
  JWT_SECRET=smoke-test-secret-not-for-real-use \
  DATABASE_URL="mongodb://127.0.0.1:$MONGO_PORT/vouchit_smoke?replicaSet=$REPL_SET" \
  FRONTEND_URL="http://localhost:$WEB_PORT" \
  WEB3_CHAIN_ID=31337 \
  WEB3_RPC_URL="http://127.0.0.1:$CHAIN_PORT" \
  VOUCHIT_ESCROW_CONTRACT_ADDRESS="$ESCROW" \
  TREASURY_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  ADMIN_RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  node dist/main.js > "$WORK/api.log" 2>&1) &
PIDS+=($!)

for _ in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$API_PORT/wagers" >/dev/null 2>&1 && break
  sleep 1
done

API="http://127.0.0.1:$API_PORT"

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

[ "$(code "$API/wagers")" = 200 ] \
  && pass "GET /wagers answers 200" \
  || { fail "GET /wagers (see $WORK/api.log)"; }

[ "$(code "$API/users/leaderboard")" = 200 ] \
  && pass "GET /users/leaderboard answers 200" \
  || fail "GET /users/leaderboard"

# :id is declared after the literal routes; if that ever flips, /users/me and
# /users/leaderboard get swallowed by the wildcard.
[ "$(code "$API/users/me")" = 401 ] \
  && pass "GET /users/me is 401 unauthenticated (route not shadowed by /users/:id)" \
  || fail "GET /users/me returned $(code "$API/users/me"), expected 401"

[ "$(code "$API/users/not-an-object-id")" = 404 ] \
  && pass "GET /users/:id with a malformed id is 404, not 500" \
  || fail "GET /users/:id malformed returned $(code "$API/users/not-an-object-id")"

# No response may carry credentials. This is the check that matters most.
BODY=$(curl -sf "$API/wagers")
if [ -z "$BODY" ]; then
  fail "GET /wagers returned nothing — leak check inconclusive, not a pass"
elif echo "$BODY" | grep -qiE '"(password|otp|otpExpiresAt)"'; then
  fail "GET /wagers leaks a credential field"
else
  pass "GET /wagers carries no password/otp fields"
fi

LEADER=$(curl -sf "$API/users/leaderboard")
if [ -z "$LEADER" ]; then
  fail "GET /users/leaderboard returned nothing — leak check inconclusive"
elif echo "$LEADER" | grep -qiE '"(email|password|otp)"'; then
  fail "GET /users/leaderboard leaks email or credentials"
else
  pass "GET /users/leaderboard carries no email or credentials"
fi

# CORS must admit the configured frontend and nothing else.
ORIGIN_OK=$(curl -s -o /dev/null -D - -H "Origin: http://localhost:$WEB_PORT" "$API/wagers" \
  | grep -ci "access-control-allow-origin")
[ "$ORIGIN_OK" -ge 1 ] \
  && pass "CORS admits FRONTEND_URL" \
  || fail "CORS did not admit FRONTEND_URL"

ORIGIN_BAD=$(curl -s -o /dev/null -D - -H "Origin: https://evil.example" "$API/wagers" \
  | grep -ci "access-control-allow-origin")
[ "$ORIGIN_BAD" -eq 0 ] \
  && pass "CORS rejects an unknown origin" \
  || fail "CORS echoed an unknown origin"

# An on-chain wager needs a linked wallet; unauthenticated must not reach that.
[ "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$API/wagers")" = 401 ] \
  && pass "POST /wagers rejects unauthenticated callers" \
  || fail "POST /wagers did not require auth"

# ----------------------------------------------------------------------- web
step "Web"
(cd "$ROOT/frontend" && \
  NEXT_PUBLIC_API_URL="$API" \
  NEXT_PUBLIC_CHAIN=baseSepolia \
  NEXT_PUBLIC_ESCROW_ADDRESS="$ESCROW" \
  PORT=$WEB_PORT \
  ./node_modules/.bin/next start -p $WEB_PORT > "$WORK/web.log" 2>&1) &
PIDS+=($!)

for _ in $(seq 1 90); do
  curl -sf "http://127.0.0.1:$WEB_PORT/auth/login" >/dev/null 2>&1 && break
  sleep 1
done

WEB="http://127.0.0.1:$WEB_PORT"
for page in /auth/login /dashboard /explore /leaderboard /wallet /settings /vouch/create; do
  STATUS=$(code "$WEB$page")
  # Authenticated pages render a client-side shell and redirect in the browser,
  # so 200 and 3xx are both healthy; 500 is an SSR crash.
  case "$STATUS" in
    200|30[0-8]) pass "GET $page renders ($STATUS)" ;;
    *) fail "GET $page returned $STATUS (see $WORK/web.log)" ;;
  esac
done

step "Result"
printf '  %d passed, %d failed\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
