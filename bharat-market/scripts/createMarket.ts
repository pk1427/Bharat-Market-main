import { ethers } from "hardhat";

async function main() {
  const factoryAddress = process.env.MARKET_FACTORY_ADDRESS!;
  const usdcAddress =
    process.env.COLLATERAL_TOKEN_ADDRESS ?? process.env.MOCK_USDC_ADDRESS!;
  const collateralIsMintable = process.env.COLLATERAL_IS_MINTABLE === "true";

  const [signer] = await ethers.getSigners();

  console.log("Using wallet:", signer.address);

  // Load contracts
  const factory = await ethers.getContractAt("MarketFactory", factoryAddress);
  const usdc = await ethers.getContractAt(
    collateralIsMintable ? "MockUSDC" : "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    usdcAddress
  );

  // --------------------------------------------------
  // STEP 1 — OPTIONAL MINT FOR MOCK COLLATERAL
  // --------------------------------------------------
  const mintAmount = ethers.parseUnits("100", 6);

  if (collateralIsMintable) {
    console.log("Minting collateral...");
    const mintTx = await (usdc as any).mint(signer.address, mintAmount);
    await mintTx.wait();
    console.log("Collateral minted ✅");
  } else {
    console.log("Skipping mint step: using external collateral token.");
  }

  // --------------------------------------------------
  // STEP 2 — APPROVE
  // --------------------------------------------------
  const fee = ethers.parseUnits("10", 6);

  console.log("Approving collateral...");
  const approveTx = await usdc.approve(factoryAddress, fee);
  await approveTx.wait();
  console.log("Collateral approved ✅");

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
  if (!receipt) {
    throw new Error("Transaction receipt was null after createMarket.");
  }

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
