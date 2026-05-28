import { getAddress } from "viem";

import { getPrismaClient } from "@/backend/db/client";
import { getFromBlockHint, INDEXER_CONFIRMATIONS } from "@/backend/indexer/config";
import { getIndexerPublicClient } from "@/backend/indexer/client";
import { syncSingleMarketIndexer } from "@/backend/indexer/core";
import { loadLocalEnvFile } from "@/backend/workers/load-env";

async function main() {
  loadLocalEnvFile();

  const marketAddressArg = process.argv[2];
  if (!marketAddressArg) {
    throw new Error("Usage: npm run indexer:market -- <marketAddress> [createdBlock]");
  }
  const createdBlockArg = process.argv[3];

  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error("DATABASE_URL is missing. Configure PostgreSQL before running the market indexer.");
  }

  const publicClient = getIndexerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const safeHead =
    latestBlock > BigInt(INDEXER_CONFIRMATIONS)
      ? latestBlock - BigInt(INDEXER_CONFIRMATIONS)
      : latestBlock;
  const floorBlock = getFromBlockHint() ?? 0n;

  const result = await syncSingleMarketIndexer({
    prisma,
    publicClient,
    marketAddress: getAddress(marketAddressArg),
    floorBlock,
    safeHead,
    createdBlockHint: createdBlockArg ? BigInt(createdBlockArg) : undefined
  });

  console.log("Indexed BharatMarket market state", result);
}

main()
  .catch((error) => {
    console.error("Failed to index BharatMarket market");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrismaClient()?.$disconnect();
  });
