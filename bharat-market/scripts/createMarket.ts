import { ethers } from "hardhat";

async function main() {
  const factoryAddress = process.env.MARKET_FACTORY_ADDRESS!;
  const usdcAddress = process.env.MOCK_USDC_ADDRESS!;

  const [signer] = await ethers.getSigners();

  console.log("Using wallet:", signer.address);

  // Load contracts
  const factory = await ethers.getContractAt("MarketFactory", factoryAddress);
  const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);

  // --------------------------------------------------
  // 🔥 STEP 1 — MINT USDC (FIX)
  // --------------------------------------------------
  const mintAmount = ethers.parseUnits("100", 6);

  console.log("Minting USDC...");
  const mintTx = await usdc.mint(signer.address, mintAmount);
  await mintTx.wait();
  console.log("USDC minted ✅");

  // --------------------------------------------------
  // STEP 2 — APPROVE
  // --------------------------------------------------
  const fee = ethers.parseUnits("10", 6);

  console.log("Approving USDC...");
  const approveTx = await usdc.approve(factoryAddress, fee);
  await approveTx.wait();
  console.log("USDC approved ✅");

  // --------------------------------------------------
  // STEP 3 — CREATE MARKET
  // --------------------------------------------------
  const endTime = Math.floor(Date.now() / 1000) + 180;

  console.log("Creating market...");

  const tx = await factory.createMarket(
    "Will BTC reach 100k?",
    endTime,
    "crypto",
    "bitcoin_price"
  );

  const receipt = await tx.wait();

  console.log("Market created ✅");

  // --------------------------------------------------
  // STEP 4 — EXTRACT MARKET ADDRESS
  // --------------------------------------------------
  let marketAddress: string | null = null;

  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === "MarketCreated") {
        marketAddress = parsed.args.market;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (marketAddress) {
    console.log("Market Address:", marketAddress);
  } else {
    console.log("⚠️ Could not find MarketCreated event");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});