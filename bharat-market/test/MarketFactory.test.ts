import { expect } from "chai";
import { ethers } from "hardhat";

describe("MarketFactory", function () {
  const ONE_USDC = 1_000_000n;

  async function deployFixture() {
    const [owner, user1] = await ethers.getSigners();

    const usdc = await ethers.deployContract("MockUSDC");
    await usdc.waitForDeployment();

    const feeVault = await ethers.deployContract("FeeVault", [owner.address]);
    await feeVault.waitForDeployment();

    const oracle = await ethers.deployContract("MarketOracle");
    await oracle.waitForDeployment();

    const factory = await ethers.deployContract("MarketFactory", [
      await usdc.getAddress(),
      await feeVault.getAddress(),
      await oracle.getAddress(),
      owner.address,
    ]);
    await factory.waitForDeployment();

    return { owner, user1, usdc, feeVault, oracle, factory };
  }

  it("Should create a new market", async function () {
    const { user1, usdc, factory } = await deployFixture();
    const latestBlock = await ethers.provider.getBlock("latest");
    const endTime = BigInt((latestBlock?.timestamp ?? 0) + 3600);

    await usdc.mint(user1.address, 100n * ONE_USDC);
    await usdc.connect(user1).approve(await factory.getAddress(), 100n * ONE_USDC);

    await factory.connect(user1).createMarket(
      "Will BTC hit 100k?",
      endTime,
      "crypto",
      "bitcoin_price"
    );

    expect(await factory.totalMarkets()).to.equal(1n);
  });

  it("Should track markets created by user", async function () {
    const { user1, usdc, factory } = await deployFixture();
    const latestBlock = await ethers.provider.getBlock("latest");
    const endTime = BigInt((latestBlock?.timestamp ?? 0) + 3600);

    await usdc.mint(user1.address, 200n * ONE_USDC);
    await usdc.connect(user1).approve(await factory.getAddress(), 200n * ONE_USDC);

    await factory.connect(user1).createMarket("Market 1", endTime, "crypto", "btc");
    await factory.connect(user1).createMarket("Market 2", endTime, "crypto", "eth");

    const markets = await factory.getMarketsByCreator(user1.address);
    expect(markets.length).to.equal(2);
  });

  it("Should return markets using pagination", async function () {
    const { user1, usdc, factory } = await deployFixture();
    const latestBlock = await ethers.provider.getBlock("latest");
    const endTime = BigInt((latestBlock?.timestamp ?? 0) + 3600);

    await usdc.mint(user1.address, 300n * ONE_USDC);
    await usdc.connect(user1).approve(await factory.getAddress(), 300n * ONE_USDC);

    for (let i = 0; i < 3; i++) {
      await factory.connect(user1).createMarket(`Market ${i}`, endTime, "crypto", "btc");
    }

    const markets = await factory.getMarkets(0, 2);
    expect(markets.length).to.equal(2);
  });
});
