# BharatMarket

Oracle-powered prediction markets for crypto and cricket, running on Polygon Amoy with USDC collateral, Chainlink Functions settlement, and an indexed backend for smooth exchange-grade UX.

## Live Links

- Live app: https://bharat-market-main.vercel.app
- Docs: https://bharat-market-main.vercel.app/docs
- Embeds: https://bharat-market-main.vercel.app/embed
- Repository: https://github.com/pk1427/Bharat-Market-main
- Polygon Amoy explorer: https://amoy.polygonscan.com

## What BharatMarket Does

BharatMarket lets users create, trade, settle, and redeem binary YES/NO prediction markets. The current production testnet flow supports:

- Crypto markets using CoinGecko data and Chainlink Functions settlement
- Cricket winner markets using CricAPI fixture data and Chainlink Functions settlement
- USDC collateral with explicit wallet approvals
- Indexed market board, portfolio, activity feed, history, and creator console
- Public API routes, webhook foundation, SDK foundation, and embeddable widgets

Election markets are intentionally marked as future-facing until a verified election result provider is added.

## Core Features

- Market creation: structured forms generate clear questions, expiry windows, and deterministic oracle metadata.
- Trading: users buy YES or NO shares with USDC and view live probability, liquidity, volume, and exposure.
- Liquidity: optional LP controls support adding and removing collateral depth from markets.
- Settlement: expired markets are resolved through provider-backed Chainlink Functions requests.
- Redemption: only winning-side holders can redeem after the on-chain outcome is finalized.
- Indexer-first UX: dashboards read backend-indexed data first, while wallet-sensitive state uses live RPC reads where needed.
- Creator tools: creators can manage markets launched from their connected wallet.
- Developer surface: docs, public APIs, SDK smoke examples, webhooks, and iframe embeds are included.

## Protocol Flow

```text
Create Market
  -> Approve USDC creation fee
  -> Deploy market from MarketFactory
  -> Index market and activity
  -> Trade YES / NO
  -> Market expires
  -> Resolution worker requests Chainlink Functions
  -> Provider data is fetched and normalized
  -> Market resolves on-chain
  -> Indexer syncs final state
  -> Winning holders redeem
```

## Architecture

```text
Frontend
  -> Public/API routes
  -> PostgreSQL indexed backend
  -> Indexer workers
  -> Resolution workers
  -> Smart contracts
  -> Chainlink Functions
  -> CoinGecko / CricAPI
```

## Public Verification

Public Amoy deployment references:

- MarketFactory: `0x5f69D163122cda1C1e2305925D143dcD93F406Cd`
- Chainlink oracle: `0xb693A863Fd3580A107297F1C246fC70924439951`
- USDC collateral: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
- Fee vault: `0x13aB65b9c696C6960781D1321AEe211844e5e18a`

Use Polygon Amoy explorer to verify creation transactions, trades, approvals, oracle requests, settlement, and redemptions.

## Repository Layout

```text
Bharat-Market-main/
├─ README.md                 Public project and protocol overview
└─ bharat-market/
   ├─ README.md              Developer setup and operations guide
   ├─ contracts/             Solidity contracts
   ├─ scripts/               Deployment and contract scripts
   ├─ sdk/                   SDK foundation and smoke examples
   ├─ test/                  Hardhat tests
   └─ frontend/              Next.js app, API routes, indexer, workers, embeds
```

## Tech Stack

- Next.js, React, Tailwind CSS
- Wagmi, Viem, RainbowKit
- Solidity, Hardhat, OpenZeppelin
- Prisma, PostgreSQL
- Chainlink Functions
- CoinGecko and CricAPI provider adapters
- Polygon Amoy testnet

## Current Stage

BharatMarket is in testnet beta. The app has working crypto and cricket market creation, trading, indexing, autonomous settlement paths, redemption, docs, embeds, and developer-facing integration foundations.

## Roadmap

- API keys and developer tiers
- Production SDK package
- Richer webhook delivery
- Creator revenue sharing
- Trader and creator reputation
- Multi-outcome markets
- Private markets and access control
- Verified election settlement
- Mainnet-readiness hardening

## Developer Setup

For local setup, contract deployment, indexer commands, worker commands, and cricket smoke testing, see:

```text
bharat-market/README.md
```
