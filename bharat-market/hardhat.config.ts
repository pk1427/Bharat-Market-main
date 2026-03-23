// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";   // includes ethers, chai, mocha, etc.
import "dotenv/config";

// ============================================================
// Environment variables — create a .env file:
//
//   PRIVATE_KEY=0xabc...          (deployer wallet private key)
//   POLYGON_AMOY_RPC=https://...  (Alchemy / Infura Amoy RPC)
//   POLYGONSCAN_API_KEY=...       (for contract verification)
// ============================================================

const PRIVATE_KEY        = process.env.PRIVATE_KEY        ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
const POLYGON_AMOY_RPC   = process.env.POLYGON_AMOY_RPC   ?? "https://rpc-amoy.polygon.technology";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },

  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // Polygon Amoy Testnet
    // Chain ID: 80002
    // Faucet:   https://faucet.polygon.technology
    // LINK:     https://faucets.chain.link (select Polygon Amoy)
    amoy: {
      url: POLYGON_AMOY_RPC,
      chainId: 80002,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
  },

  // Contract verification on Polygonscan
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL:  "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },

  // Gas reporter (optional — install hardhat-gas-reporter if wanted)
  // gasReporter: {
  //   enabled: true,
  //   currency: "USD",
  // },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },

  mocha: {
    timeout: 120_000, // 2 min — useful for testnet tests
  },
};

export default config;
