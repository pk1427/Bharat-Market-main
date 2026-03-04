import { expect } from "chai";
import hre from "hardhat";

describe("BharatMarket Prediction Market", function () {

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
  // TEST 1 — USDC MINT
  // -------------------------------

  it("Should mint USDC to users", async function () {

    await usdc.write.mint([
      user1.account.address,
      1000n * ONE_USDC
    ]);

    const balance = await usdc.read.balanceOf([
      user1.account.address
    ]);

    expect(balance).to.equal(1000n * ONE_USDC);

  });

  // -------------------------------
  // TEST 2 — BUY YES / NO
  // -------------------------------

  it("Users should buy YES and NO shares", async function () {

    await usdc.write.mint([user1.account.address, 1000n * ONE_USDC]);
    await usdc.write.mint([user2.account.address, 1000n * ONE_USDC]);

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user1.account }
    );

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user2.account }
    );

    await market.write.buyYes(
      [100n * ONE_USDC,0n],
      { account: user1.account }
    );

    await market.write.buyNo(
      [100n * ONE_USDC,0n],
      { account: user2.account }
    );

  const yesPool = await market.read.yesPool();
const noPool = await market.read.noPool();

expect(yesPool > 0n).to.equal(true);
expect(noPool > 0n).to.equal(true);

  });

  it("Preview should return expected shares", async function () {

  await usdc.write.mint([user1.account.address, 1000n * ONE_USDC]);

  const preview = await market.read.previewBuyYes([
    100n * ONE_USDC
  ]);

  expect(preview > 0n).to.equal(true);

});


it("Should revert if slippage exceeds limit", async function () {

  await usdc.write.mint([user1.account.address, 1000n * ONE_USDC]);

  await usdc.write.approve(
    [market.address, 500n * ONE_USDC],
    { account: user1.account }
  );

  let failed = false;

  try {

    await market.write.buyYes(
      [100n * ONE_USDC, 999999999n], // impossible slippage
      { account: user1.account }
    );

  } catch {
    failed = true;
  }

  expect(failed).to.equal(true);

});

  // -------------------------------
  // TEST 3 — FEE VAULT
  // -------------------------------

  it("Should collect fees in FeeVault", async function () {

    await usdc.write.mint([user1.account.address, 1000n * ONE_USDC]);

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user1.account }
    );

    await market.write.buyYes(
      [100n * ONE_USDC,0n],
      { account: user1.account }
    );

    const feeBalance = await usdc.read.balanceOf([
      feeVault.address
    ]);

    expect(feeBalance).to.equal(2n * ONE_USDC);

  });

  // -------------------------------
  // TEST 4 — MARKET RESOLUTION
  // -------------------------------

  it("Owner should resolve the market", async function () {

    await usdc.write.mint([user1.account.address, 1000n * ONE_USDC]);

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user1.account }
    );

    await market.write.buyYes(
      [100n * ONE_USDC,0n],
      { account: user1.account }
    );

    await hre.network.provider.send("evm_increaseTime", [4000]);
    await hre.network.provider.send("evm_mine");

    await market.write.resolve(
      [1],
      { account: owner.account }
    );

    const resolved = await market.read.resolved();

    expect(resolved).to.equal(true);

  });

  // -------------------------------
  // TEST 5 — WINNER REDEMPTION
  // -------------------------------

  it("Winning user should redeem payout", async function () {

    await usdc.write.mint([user1.account.address, 1000n * ONE_USDC]);

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user1.account }
    );

    await market.write.buyYes(
      [100n * ONE_USDC,0n],
      { account: user1.account }
    );

    await hre.network.provider.send("evm_increaseTime", [4000]);
    await hre.network.provider.send("evm_mine");

    await market.write.resolve(
      [1],
      { account: owner.account }
    );

    const before = await usdc.read.balanceOf([
      user1.account.address
    ]);

    await market.write.redeem(
      [],
      { account: user1.account }
    );

    const after = await usdc.read.balanceOf([
      user1.account.address
    ]);

    expect(after > before).to.equal(true);

  });

  // -------------------------------
  // TEST 6 — LOSER REDEEM FAIL
  // -------------------------------

  it("Losing side should not redeem", async function () {

    await usdc.write.mint([user1.account.address, 1000n * ONE_USDC]);
    await usdc.write.mint([user2.account.address, 1000n * ONE_USDC]);

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user1.account }
    );

    await usdc.write.approve(
      [market.address, 500n * ONE_USDC],
      { account: user2.account }
    );

    await market.write.buyYes(
      [100n * ONE_USDC,0n],
      { account: user1.account }
    );

    await market.write.buyNo(
      [100n * ONE_USDC,0n],
      { account: user2.account }
    );

    await hre.network.provider.send("evm_increaseTime", [4000]);
    await hre.network.provider.send("evm_mine");

    await market.write.resolve(
      [1],
      { account: owner.account }
    );

    let failed = false;

    try {
      await market.write.redeem(
        [],
        { account: user2.account }
      );
    } catch {
      failed = true;
    }

    expect(failed).to.equal(true);

  });

});