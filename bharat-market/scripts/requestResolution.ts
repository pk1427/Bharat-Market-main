// scripts/requestResolution.ts
//
// Triggers oracle resolution for a deployed Market.
//
// Prerequisites:
//   - ChainlinkFunctionsOracle deployed and subscribed
//   - Subscription funded with LINK
//   - Oracle added as consumer in the subscription
//   - Market end time has passed
//
// Usage:
//   MARKET_ADDRESS=0x... npx hardhat run scripts/requestResolution.ts --network amoy
//
// Or edit MARKET_ADDRESS below.

import { ethers } from "hardhat";

// ============================================================
// Config — set these before running
// ============================================================
const CHAINLINK_FUNCTIONS_ORACLE = process.env.CL_ORACLE_ADDRESS ?? "";
const MARKET_ADDRESS              = process.env.MARKET_ADDRESS    ?? "";

async function main() {
  if (!CHAINLINK_FUNCTIONS_ORACLE) {
    throw new Error(
      "Set CL_ORACLE_ADDRESS env var to the ChainlinkFunctionsOracle address"
    );
  }
  if (!MARKET_ADDRESS) {
    throw new Error("Set MARKET_ADDRESS env var to the Market address");
  }

  const [caller] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════");
  console.log("  BharatMarket — Request Oracle Resolution");
  console.log("═══════════════════════════════════════════");
  console.log("Caller   :", caller.address);
  console.log("Network  :", (await ethers.provider.getNetwork()).name);
  console.log("Market   :", MARKET_ADDRESS);
  console.log("Oracle   :", CHAINLINK_FUNCTIONS_ORACLE);
  console.log("");

  // -----------------------------------------------
  // Fetch market metadata
  // -----------------------------------------------
  const marketAbi = [
    "function oracleType() view returns (string)",
    "function oracleQuery() view returns (string)",
    "function endTime() view returns (uint256)",
    "function resolved() view returns (bool)",
  ];

  const market = new ethers.Contract(MARKET_ADDRESS, marketAbi, caller);

  const [oType, oQuery, endTime, isResolved] = await Promise.all([
    market.oracleType(),
    market.oracleQuery(),
    market.endTime(),
    market.resolved(),
  ]);

  const now = BigInt(Math.floor(Date.now() / 1000));

  console.log("Market info:");
  console.log("  oracleType  :", oType);
  console.log("  oracleQuery :", oQuery);
  console.log("  endTime     :", new Date(Number(endTime) * 1000).toISOString());
  console.log("  resolved    :", isResolved);
  console.log("  now         :", new Date(Number(now) * 1000).toISOString());
  console.log("");

  if (isResolved) {
    console.log("✅  Market is already resolved. Nothing to do.");
    return;
  }

  if (now < endTime) {
    const remaining = Number(endTime - now);
    console.log(`⏳  Market ends in ${remaining}s. Too early to resolve.`);
    return;
  }

  // -----------------------------------------------
  // Send resolution request
  // -----------------------------------------------
  const oracleAbi = [
    "function requestMarketResolution(address market) returns (bytes32)",
    "function marketPendingRequest(address) view returns (bytes32)",
    "event ResolutionRequested(bytes32 indexed requestId, address indexed market, string oracleType, string oracleQuery)",
    "event ResolutionFulfilled(bytes32 indexed requestId, address indexed market, uint8 outcome)",
    "event ResolutionFailed(bytes32 indexed requestId, address indexed market, bytes error)",
  ];

  const oracle = new ethers.Contract(
    CHAINLINK_FUNCTIONS_ORACLE,
    oracleAbi,
    caller
  );

  // Check if a request is already pending
  const pendingReqId = await oracle.marketPendingRequest(MARKET_ADDRESS);
  if (pendingReqId !== ethers.ZeroHash) {
    console.log("⏳  A request is already pending for this market.");
    console.log("    Request ID:", pendingReqId);
    console.log("    Waiting for Chainlink DON to fulfill...");
    return;
  }

  console.log("Sending resolution request to Chainlink Functions...");

  const tx = await oracle.requestMarketResolution(MARKET_ADDRESS);
  console.log("Tx hash :", tx.hash);

  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  // Parse the emitted RequestId
  const iface = new ethers.Interface(oracleAbi);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "ResolutionRequested") {
        console.log("\n✅  ResolutionRequested event:");
        console.log("    requestId  :", parsed.args.requestId);
        console.log("    market     :", parsed.args.market);
        console.log("    oracleType :", parsed.args.oracleType);
        console.log("    oracleQuery:", parsed.args.oracleQuery);
      }
    } catch {}
  }

  console.log("\n⏳  Chainlink DON is now executing the oracle script.");
  console.log("    This usually takes 1-3 minutes on Polygon Amoy.");
  console.log("    Monitor fulfillment at: https://functions.chain.link");
  console.log("");
  console.log("    Or poll market.resolved() until it returns true.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
