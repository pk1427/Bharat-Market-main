import { expect } from "chai";
import hre from "hardhat";

describe("MarketFactory", function () {

  let publicClient: any;

  let owner: any;
  let user1: any;

  let usdc: any;
  let feeVault: any;
  let factory: any;

  const ONE_USDC = 1_000_000n;

  beforeEach(async function () {

    const { viem } = hre;

    publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();

    owner = walletClients[0];
    user1 = walletClients[1];

    // Deploy MockUSDC
    usdc = await viem.deployContract("MockUSDC");

    // Deploy FeeVault
    feeVault = await viem.deployContract("FeeVault", [
      owner.account.address
    ]);

    // Deploy Factory
    factory = await viem.deployContract("MarketFactory", [
      usdc.address,
      feeVault.address,
      owner.account.address
    ]);

  });

  // ---------------------------------
  // TEST 1 — CREATE MARKET
  // ---------------------------------

  it("Should create a new market", async function () {

    const block = await publicClient.getBlock();

    const endTime = block.timestamp + 3600n;

    // Mint USDC to user
    await usdc.write.mint([
      user1.account.address,
      100n * ONE_USDC
    ]);

    // Approve creation fee
    await usdc.write.approve(
      [factory.address, 10n * ONE_USDC],
      { account: user1.account }
    );

    await factory.write.createMarket(
      ["Will BTC hit 100k?", endTime],
      { account: user1.account }
    );

    const total = await factory.read.totalMarkets();

    expect(total).to.equal(1n);

  });

  // ---------------------------------
  // TEST 2 — CREATOR MARKETS
  // ---------------------------------

  it("Should track markets created by user", async function () {

    const block = await publicClient.getBlock();

    const endTime = block.timestamp + 3600n;

    await usdc.write.mint([
      user1.account.address,
      100n * ONE_USDC
    ]);

    await usdc.write.approve(
      [factory.address, 20n * ONE_USDC],
      { account: user1.account }
    );

    await factory.write.createMarket(
      ["Market 1", endTime],
      { account: user1.account }
    );

    await factory.write.createMarket(
      ["Market 2", endTime],
      { account: user1.account }
    );

    const markets = await factory.read.getMarketsByCreator([
      user1.account.address
    ]);

    expect(markets.length).to.equal(2);

  });

  // ---------------------------------
  // TEST 3 — PAGINATION
  // ---------------------------------

  it("Should return markets using pagination", async function () {

    const block = await publicClient.getBlock();

    const endTime = block.timestamp + 3600n;

    await usdc.write.mint([
      user1.account.address,
      100n * ONE_USDC
    ]);

    await usdc.write.approve(
      [factory.address, 50n * ONE_USDC],
      { account: user1.account }
    );

    // Create 3 markets
    for (let i = 0; i < 3; i++) {
      await factory.write.createMarket(
        [`Market ${i}`, endTime],
        { account: user1.account }
      );
    }

    const markets = await factory.read.getMarkets([
      0n,
      2n
    ]);

    expect(markets.length).to.equal(2);

  });

});