# BharatMarket

BharatMarket is a decentralized prediction market protocol focused on sports-style binary markets such as IPL outcomes. The repository contains the smart-contract system, deployment scripts, local test suite, and a frontend workspace for turning the protocol into a usable product.

## Protocol Overview

The on-chain stack includes:

- `MarketFactory`: creates new markets and charges a USDC-denominated creation fee
- `Market`: constant-product binary market with YES/NO trading, liquidity, fees, resolution, and redemption
- `OutcomeToken`: ERC20 token minted for YES and NO positions
- `LiquidityToken`: ERC20 token representing LP ownership
- `FeeVault`: collects protocol fees
- `MarketOracle`: authorization layer that resolves markets securely
- `ChainlinkFunctionsOracle`: off-chain data adapter for Chainlink Functions resolution
- `MockUSDC`: 6-decimal test collateral token

## Repo Structure

```text
bharat-market/
├─ contracts/                Solidity contracts
├─ scripts/                  Deployment and interaction scripts
├─ test/                     Hardhat test suite
├─ ignition/modules/         Ignition deployment modules
├─ deployed-addresses.json   Latest saved deployment addresses
└─ frontend/                 Next.js product frontend
```

## Smart Contract Commands

Run these inside `bharat-market/`:

```bash
npm install
npm run compile
npm test
npm run deploy:all
npm run resolve
```

## Environment Variables

Create a `.env` file in `bharat-market/` for contract deployment:

```bash
PRIVATE_KEY=0x...
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=...
```

The frontend uses its own env file for deployed contract addresses and wallet setup.

## Deployment Flow

`scripts/deployAll.ts` deploys:

1. `MockUSDC`
2. `FeeVault`
3. `MarketOracle`
4. `ChainlinkFunctionsOracle`
5. `MarketFactory`

It also authorizes the Chainlink oracle inside `MarketOracle` and writes the resulting addresses to `deployed-addresses.json`.

## Tests

The local suite covers:

- market creation
- YES/NO share trading
- preview and slippage protection
- fee routing to `FeeVault`
- liquidity add/remove flows
- oracle-triggered market resolution
- winning-side redemption only

Run:

```bash
npm test
```

## Frontend Goal

The product frontend is a Next.js app with:

- wallet connection via RainbowKit
- market discovery from `MarketFactory`
- market detail and trading UI
- YES/NO balance display
- redemption flow for resolved markets
- optional liquidity management

## Network

Primary target network:

- Polygon Amoy Testnet
- Chain ID `80002`

## Notes

- `MockUSDC` uses 6 decimals
- deployed addresses should be loaded from environment variables, not hardcoded
- the Hardhat project currently warns on Node.js `21.x`; using an LTS Node version is recommended for deployment and CI stability
