import { expect } from "chai";
import { ethers } from "hardhat";

describe("BharatMarket Prediction Market", function () {
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

  it("Should mint USDC to users", async function () {
    const { user1, usdc } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);

    expect(await usdc.balanceOf(user1.address)).to.equal(1000n * ONE_USDC);
  });

  it("Users should buy YES and NO shares", async function () {
    const { user1, user2, usdc, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.mint(user2.address, 1000n * ONE_USDC);

    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);
    await usdc.connect(user2).approve(await market.getAddress(), 500n * ONE_USDC);

    await market.connect(user1).buyYes(100n * ONE_USDC, 0);
    await market.connect(user2).buyNo(100n * ONE_USDC, 0);

    expect(await market.yesPool()).to.be.greaterThan(0n);
    expect(await market.noPool()).to.be.greaterThan(0n);
  });

  it("Preview should return expected shares", async function () {
    const { market } = await deployFixture();

    expect(await market.previewBuyYes(100n * ONE_USDC)).to.be.greaterThan(0n);
  });

  it("LP fee should remain in the pool", async function () {
    const { user1, usdc, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);

    const beforePool = await market.yesPool();
    await market.connect(user1).buyYes(100n * ONE_USDC, 0);

    expect(await market.yesPool()).to.be.greaterThan(beforePool);
  });

  it("Preview should match actual shares minted", async function () {
    const { user1, usdc, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);

    const preview = await market.previewBuyYes(100n * ONE_USDC);
    const yesToken = await ethers.getContractAt("OutcomeToken", await market.yesToken());

    const before = await yesToken.balanceOf(user1.address);
    await market.connect(user1).buyYes(100n * ONE_USDC, 0);
    const after = await yesToken.balanceOf(user1.address);

    expect(after - before).to.equal(preview);
  });

  it("Should revert if slippage exceeds limit", async function () {
    const { user1, usdc, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);

    await expect(
      market.connect(user1).buyYes(100n * ONE_USDC, 999_999_999n)
    ).to.be.revertedWith("Slippage exceeded");
  });

  it("Should send protocol fee to FeeVault", async function () {
    const { user1, usdc, feeVault, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);

    await market.connect(user1).buyYes(100n * ONE_USDC, 0);

    expect(await usdc.balanceOf(await feeVault.getAddress())).to.equal(1n * ONE_USDC);
  });

  it("Owner should resolve the market", async function () {
    const { owner, user1, usdc, oracle, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);
    await market.connect(user1).buyYes(100n * ONE_USDC, 0);

    await ethers.provider.send("evm_increaseTime", [4000]);
    await ethers.provider.send("evm_mine", []);

    await oracle.connect(owner).resolveMarket(await market.getAddress(), 1);

    expect(await market.resolved()).to.equal(true);
  });

  it("Winning user should redeem payout", async function () {
    const { owner, user1, usdc, oracle, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);
    await market.connect(user1).buyYes(100n * ONE_USDC, 0);

    await ethers.provider.send("evm_increaseTime", [4000]);
    await ethers.provider.send("evm_mine", []);

    await oracle.connect(owner).resolveMarket(await market.getAddress(), 1);

    const before = await usdc.balanceOf(user1.address);
    await market.connect(user1).redeem();

    expect(await usdc.balanceOf(user1.address)).to.be.greaterThan(before);
  });

  it("Losing side should not redeem", async function () {
    const { owner, user1, user2, usdc, oracle, market } = await deployFixture();

    await usdc.mint(user1.address, 1000n * ONE_USDC);
    await usdc.mint(user2.address, 1000n * ONE_USDC);

    await usdc.connect(user1).approve(await market.getAddress(), 500n * ONE_USDC);
    await usdc.connect(user2).approve(await market.getAddress(), 500n * ONE_USDC);

    await market.connect(user1).buyYes(100n * ONE_USDC, 0);
    await market.connect(user2).buyNo(100n * ONE_USDC, 0);

    await ethers.provider.send("evm_increaseTime", [4000]);
    await ethers.provider.send("evm_mine", []);

    await oracle.connect(owner).resolveMarket(await market.getAddress(), 1);

    await expect(market.connect(user2).redeem()).to.be.revertedWith("No winning shares");
  });
});
