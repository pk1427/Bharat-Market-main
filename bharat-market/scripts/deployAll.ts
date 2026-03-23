// scripts/deployAll.ts
//
// Full BharatMarket deployment on Polygon Amoy:
//   1. MockUSDC (testnet collateral)
//   2. FeeVault
//   3. MarketOracle
//   4. ChainlinkFunctionsOracle
//   5. MarketFactory
//
// Then wires everything together:
//   - Authorizes ChainlinkFunctionsOracle in MarketOracle
//
// Usage:
//   npx hardhat run scripts/deployAll.ts --network amoy

import { ethers } from "hardhat";

// ============================================================
// Chainlink Functions — Polygon Amoy
// ============================================================
const CHAINLINK_CONFIG = {
  router: "0xC22a79eBA640940ABB6dF0f7982cc119578E11De",
  donId: ethers.encodeBytes32String("fun-polygon-amoy-1"),
  subscriptionId: 555, // ← update after creating subscription
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("═══════════════════════════════════════════════");
  console.log("  BharatMarket — Full Deployment");
  console.log("═══════════════════════════════════════════════");
  console.log("Deployer :", deployer.address);
  console.log("Network  :", network.name);
  console.log("Chain ID :", network.chainId.toString());
  console.log("");

  // -----------------------------------------------
  // 1. MockUSDC
  // -----------------------------------------------
  console.log("1/5  Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("     MockUSDC →", usdcAddress);

  // -----------------------------------------------
  // 2. FeeVault
  // -----------------------------------------------
  console.log("\n2/5  Deploying FeeVault...");
  const FeeVault = await ethers.getContractFactory("FeeVault");
  const feeVault = await FeeVault.deploy(deployer.address);
  await feeVault.waitForDeployment();
  const feeVaultAddress = await feeVault.getAddress();
  console.log("     FeeVault →", feeVaultAddress);

  // -----------------------------------------------
  // 3. MarketOracle
  // -----------------------------------------------
  console.log("\n3/5  Deploying MarketOracle...");
  const MarketOracle = await ethers.getContractFactory("MarketOracle");
  const marketOracle = await MarketOracle.deploy();
  await marketOracle.waitForDeployment();
  const marketOracleAddress = await marketOracle.getAddress();
  console.log("     MarketOracle →", marketOracleAddress);

  // -----------------------------------------------
  // 4. ChainlinkFunctionsOracle
  // -----------------------------------------------
  console.log("\n4/5  Deploying ChainlinkFunctionsOracle...");
  const CLOracle = await ethers.getContractFactory("ChainlinkFunctionsOracle");
  const clOracle = await CLOracle.deploy(
    CHAINLINK_CONFIG.router,
    CHAINLINK_CONFIG.donId,
    CHAINLINK_CONFIG.subscriptionId,
    marketOracleAddress
  );
  await clOracle.waitForDeployment();
  const clOracleAddress = await clOracle.getAddress();
  console.log("     ChainlinkFunctionsOracle →", clOracleAddress);

  // Wire: authorize CLOracle in MarketOracle
  const authTx = await marketOracle.authorizeCaller(clOracleAddress);
  await authTx.wait();
  console.log("     Authorized CLOracle in MarketOracle ✓");

  // -----------------------------------------------
  // 5. MarketFactory
  // -----------------------------------------------
  console.log("\n5/5  Deploying MarketFactory...");
  const MarketFactory = await ethers.getContractFactory("MarketFactory");
  const factory = await MarketFactory.deploy(
    usdcAddress,
    feeVaultAddress,
    marketOracleAddress, // oracle passed to each market
    deployer.address
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("     MarketFactory →", factoryAddress);

  // -----------------------------------------------
  // Summary
  // -----------------------------------------------
  console.log("\n═══════════════════════════════════════════════");
  console.log("  ✅  All Contracts Deployed");
  console.log("═══════════════════════════════════════════════");
  console.log("MockUSDC                 :", usdcAddress);
  console.log("FeeVault                 :", feeVaultAddress);
  console.log("MarketOracle             :", marketOracleAddress);
  console.log("ChainlinkFunctionsOracle :", clOracleAddress);
  console.log("MarketFactory            :", factoryAddress);

  console.log("\n─── Next Steps ─────────────────────────────────");
  console.log("1. Go to https://functions.chain.link → Polygon Amoy");
  console.log("2. Create subscription → fund with LINK");
  console.log("3. Add consumer →", clOracleAddress);
  console.log("4. Update subscriptionId in deployAll.ts + deployOracle.ts");
  console.log("5. Run a test market:");
  console.log("   MARKET_ADDRESS=<addr> CL_ORACLE_ADDRESS=" + clOracleAddress);
  console.log("   npx hardhat run scripts/requestResolution.ts --network amoy");

  // Save addresses to file for convenience
  const fs = await import("fs");
  const addresses = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    MockUSDC: usdcAddress,
    FeeVault: feeVaultAddress,
    MarketOracle: marketOracleAddress,
    ChainlinkFunctionsOracle: clOracleAddress,
    MarketFactory: factoryAddress,
  };

  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );

  console.log("\n📄  Addresses saved to deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
