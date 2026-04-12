import { getAddress } from "viem";

function parseAddress(value: string | undefined) {
  if (!value) return null;

  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

const requiredAddresses = (() => {
  const marketFactory = parseAddress(process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS);
  const usdc = parseAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS);
  const chainlinkOracle = parseAddress(process.env.NEXT_PUBLIC_CHAINLINK_ORACLE_ADDRESS);
  const marketOracle = parseAddress(process.env.NEXT_PUBLIC_MARKET_ORACLE_ADDRESS);
  const feeVault = parseAddress(process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS);
  const defaultMarket = parseAddress(process.env.NEXT_PUBLIC_DEFAULT_MARKET_ADDRESS);

  if (!marketFactory || !usdc) {
    return null;
  }

  return {
    marketFactory,
    usdc,
    chainlinkOracle,
    marketOracle,
    feeVault,
    defaultMarket
  };
})();

export function getRequiredAddresses() {
  return requiredAddresses;
}
