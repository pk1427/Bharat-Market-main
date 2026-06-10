# @bharatmarket/sdk

Protocol-facing SDK for BharatMarket.

## What it covers

- Market reads
- Portfolio reads
- Oracle catalog discovery
- Contract action helpers for create / trade / LP / redeem

## Example

```ts
import { createBharatMarketClient } from "@bharatmarket/sdk";

const sdk = createBharatMarketClient("https://bharat-market-main.vercel.app");

const markets = await sdk.getMarkets({ status: "live", limit: 20 });
const portfolio = await sdk.getPortfolio("0xdE504608441fe32BAE7fceAcF6D04Af61c39D8Ec");
const oracles = await sdk.getOracleCatalog();
```

## Contract actions

Contract action helpers are thin wrappers around the deployed factory and market contracts.
They accept a `viem` wallet client and your deployed contract addresses.
