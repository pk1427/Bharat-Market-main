import fs from "fs";

import { ethers } from "hardhat";
import { getAddress, isAddress } from "ethers";

const CHAINLINK_CONFIG = {
  router: "0xC22a79eBA640940ABB6dF0f7982cc119578E11De",
  donId: ethers.encodeBytes32String("fun-polygon-amoy-1"),
  subscriptionId: Number(process.env.CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID ?? "555")
};

function requiredAddress(name: string, fallback?: string) {
  const value = process.env[name] || fallback;
  if (!value || !isAddress(value)) {
    throw new Error(`${name} is missing or invalid.`);
  }

  return getAddress(value);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const marketOracleAddress = requiredAddress("MARKET_ORACLE_ADDRESS", process.env.NEXT_PUBLIC_MARKET_ORACLE_ADDRESS);

  console.log("═══════════════════════════════════════════════");
  console.log("  BharatMarket — Chainlink Oracle Upgrade");
  console.log("═══════════════════════════════════════════════");
  console.log("Deployer     :", deployer.address);
  console.log("Network      :", network.name);
  console.log("Chain ID     :", network.chainId.toString());
  console.log("MarketOracle :", marketOracleAddress);
  console.log("");

  const ChainlinkFunctionsOracle = await ethers.getContractFactory("ChainlinkFunctionsOracle");
  const oracle = await ChainlinkFunctionsOracle.deploy(
    CHAINLINK_CONFIG.router,
    CHAINLINK_CONFIG.donId,
    CHAINLINK_CONFIG.subscriptionId,
    marketOracleAddress
  );
  await oracle.waitForDeployment();

  const oracleAddress = await oracle.getAddress();
  console.log("ChainlinkFunctionsOracle :", oracleAddress);

  const secretsSlotId = Number(process.env.CHAINLINK_SECRETS_SLOT_ID ?? "0");
  const secretsVersion = Number(process.env.CHAINLINK_SECRETS_VERSION ?? "0");
  if (Number.isFinite(secretsVersion) && secretsVersion > 0) {
    const tx = await oracle.setDonHostedSecrets(secretsSlotId, secretsVersion);
    console.log("Secrets config tx       :", tx.hash);
    await tx.wait();
    console.log(`DON-hosted secrets      : slot ${secretsSlotId}, version ${secretsVersion}`);
  } else {
    console.log("DON-hosted secrets      : disabled (set CHAINLINK_SECRETS_VERSION to enable)");
  }

  if (process.env.CRICAPI_KEY) {
    const tx = await oracle.setCricApiKey(process.env.CRICAPI_KEY);
    console.log("CricAPI key config tx   :", tx.hash);
    await tx.wait();
    console.log("CricAPI key fallback    : configured");
  } else {
    console.log("CricAPI key fallback    : disabled (set CRICAPI_KEY to enable)");
  }

  if (process.env.CRICKET_RELAY_URL) {
    const tx = await oracle.setCricketRelayUrl(process.env.CRICKET_RELAY_URL);
    console.log("Cricket relay config tx :", tx.hash);
    await tx.wait();
    console.log("Cricket relay fallback  : configured");
  } else {
    console.log("Cricket relay fallback  : disabled (set CRICKET_RELAY_URL to enable)");
  }

  const marketOracle = await ethers.getContractAt("MarketOracle", marketOracleAddress);
  const authorized = await marketOracle.authorizedCallers(oracleAddress);
  if (!authorized) {
    const tx = await marketOracle.authorizeCaller(oracleAddress);
    console.log("Authorize tx            :", tx.hash);
    await tx.wait();
  }
  console.log("Authorized in MarketOracle ✓");

  updateAddressFile(oracleAddress);

  console.log("");
  console.log("Next:");
  console.log("1. Add this oracle as a Chainlink Functions subscription consumer:");
  console.log("   ", oracleAddress);
  console.log("2. Update frontend env NEXT_PUBLIC_CHAINLINK_ORACLE_ADDRESS to this address.");
  console.log("3. Enable NEXT_PUBLIC_STRUCTURED_ORACLES_ENABLED=true after the consumer is added.");
}

function updateAddressFile(chainlinkOracleAddress: string) {
  const file = "deployed-addresses.json";
  if (!fs.existsSync(file)) {
    return;
  }

  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        ...current,
        ChainlinkFunctionsOracle: chainlinkOracleAddress
      },
      null,
      2
    )
  );
  console.log("Updated deployed-addresses.json ✓");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
