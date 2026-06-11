import { ethers } from "hardhat";
import { getAddress, isAddress } from "ethers";

function requiredAddress(name: string, fallback?: string) {
  const value = process.env[name] || fallback;
  if (!value || !isAddress(value)) {
    throw new Error(`${name} is missing or invalid.`);
  }

  return getAddress(value);
}

async function main() {
  const oracleAddress = requiredAddress(
    "CHAINLINK_ORACLE_ADDRESS",
    process.env.NEXT_PUBLIC_CHAINLINK_ORACLE_ADDRESS || process.env.CL_ORACLE_ADDRESS
  );
  const cricApiKey = process.env.CRICAPI_KEY;
  const cricketRelayUrl = process.env.CRICKET_RELAY_URL;
  const secretsSlotId = Number(process.env.CHAINLINK_SECRETS_SLOT_ID ?? "0");
  const secretsVersion = Number(process.env.CHAINLINK_SECRETS_VERSION ?? "0");

  const oracle = await ethers.getContractAt("ChainlinkFunctionsOracle", oracleAddress);

  console.log("Configuring ChainlinkFunctionsOracle:", oracleAddress);

  if (Number.isFinite(secretsVersion) && secretsVersion > 0) {
    const tx = await oracle.setDonHostedSecrets(secretsSlotId, secretsVersion);
    console.log("Secrets config tx:", tx.hash);
    await tx.wait();
  }

  if (cricApiKey) {
    const tx = await oracle.setCricApiKey(cricApiKey);
    console.log("CricAPI key config tx:", tx.hash);
    await tx.wait();
  }

  if (cricketRelayUrl) {
    const tx = await oracle.setCricketRelayUrl(cricketRelayUrl);
    console.log("Cricket relay config tx:", tx.hash);
    await tx.wait();
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
