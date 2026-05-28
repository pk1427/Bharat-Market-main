# BharatMarket Phase 4: Stabilization + Production Validation

This phase is about validating BharatMarket as a real exchange system.

We are no longer prioritizing feature expansion. We are prioritizing:

- flow reliability
- indexed/backend correctness
- realtime correctness
- graceful degradation
- user trust under edge cases

## Current Product Stage

BharatMarket has already completed:

- prediction market protocol
- Polygon Amoy integration
- frontend redesign
- indexed backend foundation
- DB-first frontend migration
- SSE/live invalidation foundation

Phase 4 is the checkpoint where we prove the system behaves correctly as a product, not just as a codebase.

---

## How To Use This Checklist

For each section, track:

- `Status`: `Not Started` | `In Progress` | `Blocked` | `Passed`
- `Owner`
- `Last Verified`
- `Notes`

When validating a flow, always compare:

1. frontend visible state
2. backend API response
3. indexed PostgreSQL state
4. on-chain state

---

## Exit Criteria For Phase 4

Phase 4 is complete when:

- all critical user flows are verified end-to-end
- indexed DB state matches chain state for key entities
- fallback behavior is verified under RPC/indexing degradation
- realtime invalidation works and reconnects safely
- no critical stale-state or duplicate-processing bugs remain
- mobile and desktop trading flows are usable and stable

---

# 1. End-to-End Flow Testing

## 1.1 Market Creation Flow

Status: `Not Started`

Test:

- valid market creation
- invalid duration
- invalid oracle query
- duplicate submission clicks
- insufficient USDC
- wallet disconnect during tx
- rejected transaction
- network switch during flow

Verify:

- market creation transaction result
- market row created in PostgreSQL
- initial snapshot created
- market appears on board
- activity feed reflects creation
- live invalidation updates board

Checkpoints:

- `/create-market`
- `/api/markets`
- `Market` table
- `MarketSnapshot` table
- `IndexerCursor`

## 1.2 Trading Flow

Status: `Not Started`

Test:

- YES buy
- NO buy
- tiny trades
- larger trades
- repeated rapid trades
- insufficient balance
- approval rejection
- stale market price / delayed UI update

Verify:

- probability shift correctness
- new `Trade` row inserted
- new `MarketSnapshot` row inserted
- board probability updates
- chart updates
- portfolio updates
- activity updates
- no duplicate trade rendering

Checkpoints:

- `/markets/[address]`
- `/my-account`
- `Trade` table
- `MarketSnapshot` table
- `WalletPosition` table

## 1.3 Liquidity Flow

Status: `Not Started`

Test:

- add liquidity
- remove liquidity
- repeated LP actions
- tiny LP amounts
- partial liquidity scenarios

Verify:

- `LiquidityEvent` row insertion
- LP position changes
- pool depth changes
- board liquidity updates
- portfolio LP display updates

Checkpoints:

- `/markets/[address]`
- `/my-account`
- `LiquidityEvent` table
- `WalletLiquidityPosition` table

## 1.4 Resolution Flow

Status: `Not Started`

Test:

- request resolution
- fulfilled resolution
- failed resolution
- double resolution attempt
- request before valid market end

Verify:

- market status closes correctly
- `OracleEvent` rows inserted
- resolved outcome updates in `Market`
- activity feed reflects oracle path
- winning side display is correct
- redemption gate opens correctly

Checkpoints:

- `/markets/[address]`
- `OracleEvent` table
- `Market.outcome`
- `Market.resolved`

## 1.5 Redemption Flow

Status: `Not Started`

Test:

- winner redeem
- loser redeem
- redeem before resolution
- double redeem attempt
- zero redeemable balance

Verify:

- wallet balance change
- `Redemption` row insertion
- portfolio update
- activity feed update
- resolved market state remains consistent

Checkpoints:

- `/markets/[address]`
- `/my-account`
- `Redemption` table
- `WalletPosition`

---

# 2. Realtime Validation

## 2.1 Board Realtime

Status: `Not Started`

Verify:

- SSE connects on homepage
- board refreshes after indexed data changes
- top movers/trending update through invalidation
- board reconnect behavior is safe

Checkpoints:

- `/`
- `/api/stream?scope=board`

## 2.2 Market Realtime

Status: `Not Started`

Verify:

- detail stream connects
- chart invalidates on indexed updates
- activity feed invalidates on indexed updates
- stream reconnects cleanly
- no broken state during temporary stream failure

Checkpoints:

- `/markets/[address]`
- `/api/stream?scope=market&market=<address>`

## 2.3 Portfolio Realtime

Status: `Not Started`

Verify:

- portfolio stream connects
- account page reflects new trades/redemptions
- wallet summary updates after indexed changes
- no excessive rerendering

Checkpoints:

- `/my-account`
- `/api/stream?scope=portfolio&wallet=<address>`

## 2.4 Multi-Tab / Reconnect

Status: `Not Started`

Test:

- two tabs open on same market
- board + account open together
- close/reopen tab
- suspend/resume laptop
- network disconnect/reconnect

Verify:

- no duplicate SSE side effects
- query invalidation stays correct
- app recovers from reconnect

---

# 3. Indexer Reliability Testing

## 3.1 Restart + Cursor Recovery

Status: `Not Started`

Test:

- stop indexer
- restart indexer
- rerun single-market indexer
- rerun loop worker

Verify:

- `IndexerCursor` resumes correctly
- no duplicate rows
- no snapshot gaps

## 3.2 Duplicate Event Protection

Status: `Not Started`

Verify:

- event replay does not create duplicate:
  - `Trade`
  - `LiquidityEvent`
  - `Redemption`
  - `OracleEvent`
  - `MarketSnapshot`

Check:

- `eventKey` uniqueness
- market counts before/after rerun

## 3.3 Backfill + Delayed Sync

Status: `Not Started`

Test:

- fresh database bootstrap
- delayed indexer catch-up
- partial index lag

Verify:

- frontend remains usable
- fallback paths engage cleanly
- indexed APIs recover once data lands

---

# 4. RPC Failure Testing

Status: `Not Started`

Simulate:

- RPC timeout
- RPC slow response
- RPC log limit errors
- partial chain reads failing

Verify:

- cached/indexed data still renders
- warning states appear
- UI does not hard-crash
- market/portfolio pages remain usable

Key routes:

- `/api/markets`
- `/api/markets/[address]`
- `/api/markets/[address]/history`
- `/api/markets/[address]/activity`
- `/api/portfolio`
- `/api/wallet`

---

# 5. UI/UX Validation

Status: `Not Started`

Manual product-use pass:

- create a market
- trade a market
- add/remove liquidity
- request resolution
- redeem
- browse history
- use account page like a real trader

Look for:

- confusing actions
- weak loading states
- missing disabled states
- inconsistent feedback
- hidden stale-state issues

---

# 6. Mobile Validation

Status: `Not Started`

Verify:

- homepage board usability
- market detail trading flow
- chart readability
- wallet connection
- activity feed usability
- portfolio filters/table readability

Devices / widths:

- narrow mobile
- mid mobile
- small tablet

---

# 7. Performance Validation

Status: `Not Started`

Measure:

- homepage load time
- market detail first render
- chart render cost
- portfolio hydration time
- indexed API latency
- SSE stability over time

Watch for:

- repeated requests
- unnecessary invalidations
- expensive client derivation
- over-polling despite live stream

---

# 8. Security + Safety Validation

Status: `Not Started`

Verify:

- route param validation
- malformed request handling
- abuse-resistant internal routes
- no accidental secret exposure
- wallet/account mismatch handling
- wrong-network handling

Important checks:

- `/api/internal/indexer-sync`
- `/api/internal/indexer-status`
- `/api/stream`

---

# 9. Data Consistency Validation

Status: `Not Started`

For the same market and wallet, compare:

- blockchain state
- PostgreSQL indexed state
- frontend rendered state

Verify consistency for:

- probabilities
- pools
- volume
- trader count
- positions
- LP balances
- redeemable value
- resolved outcome

This is the most important architecture validation step.

---

# 10. Readiness Tracker

## Critical Flows

| Area | Status | Indexed Verified | Realtime Verified | Fallback Verified | Mobile Checked | Notes |
|---|---|---:|---:|---:|---:|---|
| Market creation | Not Started | No | No | No | No | |
| Trading | Not Started | No | No | No | No | |
| Liquidity | Not Started | No | No | No | No | |
| Resolution | Not Started | No | No | No | No | |
| Redemption | Not Started | No | No | No | No | |

## System Reliability

| Area | Status | Verified | Notes |
|---|---|---:|---|
| SSE reconnect behavior | Not Started | No | |
| Indexer restart recovery | Not Started | No | |
| Duplicate protection | Not Started | No | |
| RPC degradation fallback | Not Started | No | |
| DB/frontend consistency | Not Started | No | |

---

# Recommended Execution Order

1. Market creation
2. Trading
3. Liquidity
4. Resolution
5. Redemption
6. Realtime validation
7. Indexer reliability
8. RPC failure tests
9. Mobile validation
10. Data consistency audit

---

# Notes

- Do not add AI/social/advanced systems before this checklist is meaningfully worked through.
- If a serious mismatch appears between chain, DB, and frontend, treat that as a release-blocking issue.
- Every bug found in this phase increases product trust more than a new feature would.
