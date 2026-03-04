import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BharatMarketModule = buildModule("BharatMarketModule", (m) => {

  // Deploy Mock USDC
  const mockUSDC = m.contract("MockUSDC");

  // Deploy FeeVault
  const feeVault = m.contract("FeeVault", [m.getAccount(0)]);

  // End time example (far future)
  const endTime = Math.floor(Date.now() / 1000) + 3600;

  // Deploy Market
  const market = m.contract("Market", [
    mockUSDC,
    feeVault,
    endTime,
    "Will CSK win?",
    m.getAccount(0)
  ]);

  return { mockUSDC, feeVault, market };
});

export default BharatMarketModule;