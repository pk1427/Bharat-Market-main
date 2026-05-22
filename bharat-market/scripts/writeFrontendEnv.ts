import fs from "node:fs";
import path from "node:path";

type AddressBook = {
  MarketFactory?: string | null;
  CollateralToken?: string | null;
  MockUSDC?: string | null;
  MarketOracle?: string | null;
  ChainlinkFunctionsOracle?: string | null;
  FeeVault?: string | null;
};

function readJson(filePath: string): AddressBook {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}. Deploy first or create the file.`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as AddressBook;
}

function required(value: string | undefined, label: string) {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${label}`);
  }

  return value.trim();
}

function optional(value: string | undefined) {
  return value?.trim() ? value.trim() : null;
}

async function main() {
  const repoRoot = process.cwd();
  const frontendDir = path.join(repoRoot, "frontend");
  const addressesPath = path.join(repoRoot, "deployed-addresses.json");
  const outputPath = path.join(frontendDir, ".env.local.generated");
  const addresses = readJson(addressesPath);

  const walletConnectProjectId = required(
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
  );
  const rpcUrl = required(
    process.env.NEXT_PUBLIC_AMOY_RPC_URL ?? process.env.POLYGON_AMOY_RPC,
    "NEXT_PUBLIC_AMOY_RPC_URL or POLYGON_AMOY_RPC"
  );
  const marketFactory = required(addresses.MarketFactory ?? undefined, "deployed-addresses.json: MarketFactory");
  const collateralToken = required(
    addresses.CollateralToken ?? addresses.MockUSDC ?? undefined,
    "deployed-addresses.json: CollateralToken or MockUSDC"
  );
  const marketOracle = required(addresses.MarketOracle ?? undefined, "deployed-addresses.json: MarketOracle");
  const chainlinkOracle = required(
    addresses.ChainlinkFunctionsOracle ?? undefined,
    "deployed-addresses.json: ChainlinkFunctionsOracle"
  );
  const feeVault = required(addresses.FeeVault ?? undefined, "deployed-addresses.json: FeeVault");
  const defaultMarket = optional(process.env.NEXT_PUBLIC_DEFAULT_MARKET_ADDRESS);
  const factoryDeployBlock = optional(process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK);
  const collateralLabel = process.env.NEXT_PUBLIC_COLLATERAL_LABEL?.trim() || "USDC";
  const collateralSymbol = process.env.NEXT_PUBLIC_COLLATERAL_SYMBOL?.trim() || "USDC";
  const collateralIsMintable = process.env.NEXT_PUBLIC_COLLATERAL_IS_MINTABLE?.trim() || "false";
  const faucetUrl = optional(process.env.NEXT_PUBLIC_COLLATERAL_FAUCET_URL);

  const lines = [
    `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${walletConnectProjectId}`,
    `NEXT_PUBLIC_AMOY_RPC_URL=${rpcUrl}`,
    "NEXT_PUBLIC_RPC_PROXY_URL=/api/rpc",
    `NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=${marketFactory}`,
    `NEXT_PUBLIC_USDC_ADDRESS=${collateralToken}`,
    `NEXT_PUBLIC_COLLATERAL_LABEL=${collateralLabel}`,
    `NEXT_PUBLIC_COLLATERAL_SYMBOL=${collateralSymbol}`,
    `NEXT_PUBLIC_COLLATERAL_IS_MINTABLE=${collateralIsMintable}`,
    `NEXT_PUBLIC_MARKET_ORACLE_ADDRESS=${marketOracle}`,
    `NEXT_PUBLIC_CHAINLINK_ORACLE_ADDRESS=${chainlinkOracle}`,
    `NEXT_PUBLIC_FEE_VAULT_ADDRESS=${feeVault}`,
    defaultMarket ? `NEXT_PUBLIC_DEFAULT_MARKET_ADDRESS=${defaultMarket}` : "# NEXT_PUBLIC_DEFAULT_MARKET_ADDRESS=",
    faucetUrl ? `NEXT_PUBLIC_COLLATERAL_FAUCET_URL=${faucetUrl}` : "# NEXT_PUBLIC_COLLATERAL_FAUCET_URL=",
    factoryDeployBlock ? `NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK=${factoryDeployBlock}` : "# NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK=",
  ];

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Generated ${outputPath}`);
  console.log("Review it, then copy it to frontend/.env.local when you're ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
