import { expect } from "chai";
import hre from "hardhat";

describe("Market Liquidity", function () {

  let publicClient: any;

  let owner: any;
  let user1: any;
  let user2: any;

  let usdc: any;
  let market: any;
  let feeVault: any;

  const ONE_USDC = 1_000_000n;

  beforeEach(async function () {

    const { viem } = hre;

    publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();

    owner = walletClients[0];
    user1 = walletClients[1];
    user2 = walletClients[2];

    // Deploy MockUSDC
    usdc = await viem.deployContract("MockUSDC");

    // Deploy FeeVault
    feeVault = await viem.deployContract("FeeVault", [
      owner.account.address
    ]);

    const block = await publicClient.getBlock();
    const endTime = block.timestamp + 3600n;

    // Deploy Market
    market = await viem.deployContract("Market", [
      usdc.address,
      feeVault.address,
      endTime,
      "Will CSK win?",
      owner.account.address
    ]);

  });

  // -------------------------------
  // TEST 1 — ADD LIQUIDITY
  // -------------------------------

  it("User should add liquidity and receive LP tokens", async function () {

    await usdc.write.mint([
      user1.account.address,
      1000n * ONE_USDC
    ]);

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user1.account }
    );

    await market.write.addLiquidity(
      [100n * ONE_USDC],
      { account: user1.account }
    );

    const lpTokenAddress = await market.read.lpToken();

    const lpToken = await hre.viem.getContractAt(
      "LiquidityToken",
      lpTokenAddress
    );

    const balance = await lpToken.read.balanceOf([
      user1.account.address
    ]);

    expect(balance > 0n).to.equal(true);

  });

  // -------------------------------
  // TEST 2 — POOL SIZE INCREASES
  // -------------------------------

  it("Liquidity should increase pool size", async function () {

    await usdc.write.mint([
      user1.account.address,
      1000n * ONE_USDC
    ]);

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user1.account }
    );

    const beforeYes = await market.read.yesPool();
    const beforeNo = await market.read.noPool();

    await market.write.addLiquidity(
      [100n * ONE_USDC],
      { account: user1.account }
    );

    const afterYes = await market.read.yesPool();
    const afterNo = await market.read.noPool();

    expect(afterYes > beforeYes).to.equal(true);
    expect(afterNo > beforeNo).to.equal(true);

  });

  // -------------------------------
  // TEST 3 — REMOVE LIQUIDITY
  // -------------------------------

  it("User should remove liquidity and receive USDC", async function () {

    await usdc.write.mint([
  user1.account.address,
  1000n * ONE_USDC
]);

// fund market to match initial pools
await usdc.write.mint([
  market.address,
  3000n * ONE_USDC
]);

await usdc.write.approve(
  [market.address, 500n * ONE_USDC],
  { account: user1.account }
);

await market.write.addLiquidity(
  [100n * ONE_USDC],
  { account: user1.account }
);

const lpTokenAddress = await market.read.lpToken();

const lpToken = await hre.viem.getContractAt(
  "LiquidityToken",
  lpTokenAddress
);

const lpBalance = await lpToken.read.balanceOf([
  user1.account.address
]);

const before = await usdc.read.balanceOf([
  user1.account.address
]);

await market.write.removeLiquidity(
  [lpBalance],
  { account: user1.account }
);

const after = await usdc.read.balanceOf([
  user1.account.address
]);

expect(after > before).to.equal(true);  });

});