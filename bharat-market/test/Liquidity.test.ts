import { expect } from "chai";
import { ethers } from "hardhat";

describe("Market Liquidity", function () {
  const ONE_USDC = 1_000_000n;

  async function deployFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const usdc = await ethers.deployContract("MockUSDC");
    await usdc.waitForDeployment();

    const feeVault = await ethers.deployContract("FeeVault", [owner.address]);
    await feeVault.waitForDeployment();

    const oracle = await ethers.deployContract("MarketOracle");
    await oracle.waitForDeployment();

    const latestBlock = await ethers.provider.getBlock("latest");
    const endTime = BigInt((latestBlock?.timestamp ?? 0) + 3600);

    const market = await ethers.deployContract("Market", [
      await usdc.getAddress(),
      await feeVault.getAddress(),
      endTime,
      "Will CSK win?",
      owner.address,
      await oracle.getAddress(),
      "sports",
      "csk_vs_mi",
    ]);
    await market.waitForDeployment();

    return { owner, user1, user2, usdc, feeVault, oracle, market };
  }

  it("User should add liquidity and receive LP tokens", async function () {
    const { user1, usdc, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);
    await market.connect(user1).addLiquidity(100n * ONE_USDC);

    const lpToken = await ethers.getContractAt("LiquidityToken", await market.lpToken());
    expect(await lpToken.balanceOf(user1.address)).to.be.greaterThan(0n);
  });

  it("Liquidity should increase pool size", async function () {
    const { user1, usdc, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);

    const beforeYes = await market.yesPool();
    const beforeNo = await market.noPool();

    await market.connect(user1).addLiquidity(100n * ONE_USDC);

    expect(await market.yesPool()).to.be.greaterThan(beforeYes);
    expect(await market.noPool()).to.be.greaterThan(beforeNo);
  });

  it("User should remove liquidity and receive USDC", async function () {
    const { user1, usdc, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.mint(await market.getAddress(), 3000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);

    await market.connect(user1).addLiquidity(100n * ONE_USDC);

    const lpToken = await ethers.getContractAt("LiquidityToken", await market.lpToken());
    const lpBalance = await lpToken.balanceOf(user1.address);
    const before = await usdc.balanceOf(user1.address);

    await market.connect(user1).removeLiquidity(lpBalance);

    expect(await usdc.balanceOf(user1.address)).to.be.greaterThan(before);
  });
});
