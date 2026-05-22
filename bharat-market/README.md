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
- `MockUSDC`: 6-decimal test collateral token for local/demo deployments

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
npm run sync:frontend-env
npm run resolve
```

## Environment Variables

Create a `.env` file in `bharat-market/` for contract deployment:

```bash
PRIVATE_KEY=0x...
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=...
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=555
# Optional: use an existing ERC20 collateral token instead of deploying MockUSDC
# COLLATERAL_TOKEN_ADDRESS=0x...
# COLLATERAL_TOKEN_LABEL=USDC
```

The frontend uses its own env file for deployed contract addresses and wallet setup.

## Polygon Amoy Staging With External USDC

For staging against an external test token instead of `MockUSDC`:

1. Fill in [`./.env.example`](./.env.example) as your real `.env`
2. Keep `COLLATERAL_TOKEN_ADDRESS` set to the Polygon Amoy USDC test token
3. Run:

```bash
npm run deploy:all
npm run sync:frontend-env
```

4. Copy `frontend/.env.local.generated` to `frontend/.env.local`
5. Redeploy or restart the frontend

This keeps the contracts, frontend, and deployment addresses aligned for external-collateral staging.

Notes:

- `npm run deploy:all` is the external-collateral deployment path for staging.
- The Ignition module remains a simple `MockUSDC` deployment path for local and demo flows.
- Sports markets are ready for staging with the current oracle setup.
- Crypto markets still use Chainlink Functions plus offchain API logic rather than direct onchain Chainlink Data Feeds.

## Deployment Flow

`scripts/deployAll.ts` deploys:

1. a collateral token
   `MockUSDC` by default, or an existing token if `COLLATERAL_TOKEN_ADDRESS` is set
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

The frontend also supports environment-driven collateral behavior so the same UI can run in:

- `MockUSDC` mode with a mint button for demo/test flows
- external-token mode with faucet guidance for real staging collateral

## Network

Primary target network:

- Polygon Amoy Testnet
- Chain ID `80002`

## Notes

- `MockUSDC` uses 6 decimals
- Polygon Amoy staging can be upgraded to an external USDC test token by redeploying `MarketFactory` with a new collateral address
- deployed addresses should be loaded from environment variables, not hardcoded
- the Hardhat project currently warns on Node.js `21.x`; using an LTS Node version is recommended for deployment and CI stability
