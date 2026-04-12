import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BharatMarketModule = buildModule("BharatMarketModule", (m) => {
  const mockUSDC = m.contract("MockUSDC");
  const feeVault = m.contract("FeeVault", [m.getAccount(0)]);
  const marketOracle = m.contract("MarketOracle");

  const router = m.getParameter(
    "router",
    "0xC22a79eBA640940ABB6dF0f7982cc119578E11De"
  );
  const donId = m.getParameter("donId", "0x66756e2d706f6c79676f6e2d616d6f792d310000000000000000000000000000");
  const subscriptionId = m.getParameter("subscriptionId", 555);

  const chainlinkFunctionsOracle = m.contract("ChainlinkFunctionsOracle", [
    router,
    donId,
    subscriptionId,
    marketOracle,
  ]);

  m.call(marketOracle, "authorizeCaller", [chainlinkFunctionsOracle]);

  const marketFactory = m.contract("MarketFactory", [
    mockUSDC,
    feeVault,
    marketOracle,
    m.getAccount(0),
  ]);

  return {
    mockUSDC,
    feeVault,
    marketOracle,
    chainlinkFunctionsOracle,
    marketFactory,
  };
});

export default BharatMarketModule;
