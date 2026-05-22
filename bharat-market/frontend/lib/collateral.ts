export const collateralConfig = {
  label: process.env.NEXT_PUBLIC_COLLATERAL_LABEL?.trim() || "USDC",
  symbol: process.env.NEXT_PUBLIC_COLLATERAL_SYMBOL?.trim() || "USDC",
  isMintable: process.env.NEXT_PUBLIC_COLLATERAL_IS_MINTABLE === "true",
  faucetUrl: process.env.NEXT_PUBLIC_COLLATERAL_FAUCET_URL?.trim() || null,
};
