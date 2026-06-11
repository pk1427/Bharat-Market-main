# BharatMarket Developer Guide

This folder contains the full BharatMarket implementation: Solidity contracts, deployment scripts, SDK foundation, tests, and the Next.js frontend with backend API routes, indexer workers, resolution workers, embeds, and documentation.

For the public project overview, use the repository root `README.md`.

## Workspace Layout

```text
bharat-market/
├─ contracts/                Solidity protocol contracts
├─ scripts/                  Hardhat deployment and utility scripts
├─ sdk/                      SDK foundation and smoke examples
├─ test/                     Hardhat test suite
├─ deployed-addresses.json   Latest saved deployment references
└─ frontend/
   ├─ app/                   Next.js routes, pages, and API handlers
   ├─ backend/               Indexer, services, workers, and Prisma access
   ├─ components/            Product UI and market interaction components
   ├─ lib/                   Client utilities, ABIs, formatting, config
   ├─ prisma/                Database schema
   └─ scripts/               Frontend smoke scripts
```

## Protocol Components

- `MarketFactory`: creates YES/NO markets and collects the USDC creation fee.
- `Market`: handles trading, liquidity, settlement state, and redemption.
- `OutcomeToken`: ERC-20-style YES and NO position tokens.
- `LiquidityToken`: LP ownership token for market liquidity providers.
- `FeeVault`: receives protocol creation fees.
- `MarketOracle`: authorization layer for settlement callers.
- `ChainlinkFunctionsOracle`: provider-backed settlement relay for crypto and cricket markets.
- `MockUSDC`: local/demo collateral token for non-production test flows.

## Live Testnet Deployment

Current public Amoy references:

```text
MarketFactory:       0x5f69D163122cda1C1e2305925D143dcD93F406Cd
Chainlink Oracle:    0xb693A863Fd3580A107297F1C246fC70924439951
USDC collateral:     0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582
Fee vault:           0x13aB65b9c696C6960781D1321AEe211844e5e18a
Network:             Polygon Amoy, chain id 80002
```

Never commit private keys, API keys, database URLs, or Vercel secrets.

## Contract Setup

Run these commands inside `bharat-market/`.

```bash
npm install
npm run compile
npm test
```

Deploy the full contract stack to Amoy:

```bash
npm run deploy:all
```

Deploy only the Chainlink Functions oracle:

```bash
npm run deploy:chainlink-oracle
```

Sync deployment addresses into the frontend env template:

```bash
npm run sync:frontend-env
```

## Contract Environment

Create `bharat-market/.env` from `.env.example`.

Required deployment values:

```bash
PRIVATE_KEY=0x...
POLYGON_AMOY_RPC=https://...
POLYGONSCAN_API_KEY=...
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=555
```

Optional external collateral values:

```bash
COLLATERAL_TOKEN_ADDRESS=0x...
COLLATERAL_TOKEN_LABEL=USDC
COLLATERAL_TOKEN_SYMBOL=USDC
COLLATERAL_IS_MINTABLE=false
```

Use `COLLATERAL_TOKEN_ADDRESS` for Polygon Amoy USDC-style staging. Leave it unset only for local/demo `MockUSDC` flows.

## Frontend Setup

Run these commands inside `bharat-market/frontend/`.

```bash
npm install
npm run db:generate
npm run dev
```

Build check:

```bash
npm run build
```

Type check:

```bash
npx tsc --noEmit
```

## Frontend Environment

Create `bharat-market/frontend/.env.local`.

Important public values:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_AMOY_RPC_URL=...
NEXT_PUBLIC_RPC_PROXY_URL=/api/rpc
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=...
NEXT_PUBLIC_USDC_ADDRESS=...
NEXT_PUBLIC_MARKET_ORACLE_ADDRESS=...
NEXT_PUBLIC_CHAINLINK_ORACLE_ADDRESS=...
NEXT_PUBLIC_FEE_VAULT_ADDRESS=...
NEXT_PUBLIC_COLLATERAL_LABEL=USDC
NEXT_PUBLIC_COLLATERAL_SYMBOL=USDC
NEXT_PUBLIC_COLLATERAL_IS_MINTABLE=false
NEXT_PUBLIC_STRUCTURED_ORACLES_ENABLED=true
```

Important server-only values:

```bash
DATABASE_URL=postgresql://...
INDEXER_RPC_URL=...
INDEXER_CONFIRMATIONS=5
INDEXER_BATCH_SIZE=2000
INDEXER_REORG_BUFFER=8
INDEXER_SYNC_INTERVAL_MS=30000
INDEXER_CRON_SECRET=...
EXCHANGE_SYNC_SECRET=...
RESOLUTION_WORKER_PRIVATE_KEY=0x...
RESOLUTION_RETRY_COOLDOWN_MS=1800000
CRICAPI_KEY=...
```

Do not expose server-only values through `NEXT_PUBLIC_`.

## Database

Generate Prisma client:

```bash
npm run db:generate
```

Push schema changes:

```bash
npm run db:push
```

Use migrations during schema evolution when production history needs to be preserved:

```bash
npm run db:migrate
```

## Indexer Commands

Index all known markets once:

```bash
npm run indexer:markets
```

Index one market:

```bash
npm run indexer:market -- 0xMarketAddress
```

Run the indexer loop:

```bash
npm run indexer:loop
```

The frontend should read market board, history, activity, portfolio, and oracle state from indexed backend APIs first. Direct RPC reads should be limited to wallet-sensitive live state and fallback hydration.

## Resolution Worker

Run the autonomous settlement loop:

```bash
npm run resolution:loop
```

The worker:

- scans expired unresolved markets from the database
- hydrates already-resolved chain state when the database is stale
- prechecks provider readiness
- requests Chainlink Functions settlement
- respects retry cooldowns
- stores oracle lifecycle state for frontend display

Production automation can call the Vercel-compatible internal sync routes using the configured secrets.

## Cricket Smoke Testing

Run:

```bash
npm run smoke:cricket
```

Useful optional environment values:

```bash
CRICAPI_KEY=...
CRICKET_MATCH_ID=...
CRICKET_YES_TEAM=...
CRICKET_DURATION_MINUTES=5
```

If `CRICKET_MATCH_ID` is omitted, the smoke script can attempt fixture discovery. For real creator UX, the Create page includes a fixture picker so creators do not need to manually find IDs.

## Public App Routes

- `/` - landing page
- `/markets` - indexed market board
- `/markets/[address]` - market trading and settlement terminal
- `/create-market` - creator console
- `/history` - market archive
- `/my-account` - wallet portfolio and positions
- `/manage-markets` - creator market management
- `/embed` - embed documentation
- `/embed/board` - compact board widget
- `/embed/market/[address]` - compact market widget
- `/docs` - protocol documentation and public proofs

## Public API

```text
GET /api/public/markets
GET /api/public/markets/[address]
GET /api/public/portfolio/[wallet]
GET /api/public/oracles
```

## Webhook Events

Current webhook event model:

```text
market.created
trade.executed
liquidity.added
oracle.requested
oracle.completed
market.resolved
```

## Testing Checklist

Before pushing major changes:

```bash
cd bharat-market/frontend
npx tsc --noEmit
npm run build
```

For contract changes:

```bash
cd bharat-market
npm run compile
npm test
```

## Known Local Notes

- On Windows, Next may warn that `@next/swc-win32-x64-msvc` is not a valid Win32 application. The build can still pass by falling back to the WASM SWC build.
- If `npm run build` fails with `EPERM` on `.next/trace`, stop any running Next dev process or rerun after the file lock clears.
- Polygon Amoy gas pricing can be noisy; MetaMask may require manually increasing priority fee during busy periods.

## Current Product Stage

Live on testnet:

- crypto market creation, trading, settlement, and redemption
- cricket fixture creation path and winner-market settlement path
- backend indexer and portfolio reads
- autonomous resolution worker
- public docs with proof links
- embeds, public APIs, webhook foundation, and SDK foundation

Planned:

- API keys
- production SDK package
- richer webhook delivery
- creator revenue sharing
- reputation system
- multi-outcome markets
- private markets
- verified election settlement
- mainnet-readiness hardening
