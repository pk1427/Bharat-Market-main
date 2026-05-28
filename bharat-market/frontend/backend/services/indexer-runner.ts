import { getPrismaClient } from "@/backend/db/client";
import { getIndexerPublicClient } from "@/backend/indexer/client";
import { syncProtocolIndexer } from "@/backend/indexer/core";
import { acquireIndexerLease, releaseIndexerLease } from "@/backend/indexer/lease";
import { getRequiredAddresses } from "@/lib/contracts";

export async function runIndexerSync(reason: "manual" | "cron" | "loop" = "manual") {
  const prisma = getPrismaClient();
  const addresses = getRequiredAddresses();
  const bypassLease = process.env.INDEXER_BYPASS_LEASE === "1";

  if (!prisma) {
    throw new Error("DATABASE_URL is missing. Configure PostgreSQL before running the indexer.");
  }

  if (!addresses) {
    throw new Error("Required contract addresses are missing from frontend env configuration.");
  }

  const acquired = bypassLease ? true : await acquireIndexerLease(prisma);
  if (!acquired) {
    return {
      status: "skipped" as const,
      reason: "Indexer sync is already running."
    };
  }

  try {
    const result = await syncProtocolIndexer({
      prisma,
      publicClient: getIndexerPublicClient(),
      addresses: {
        marketFactory: addresses.marketFactory,
        chainlinkOracle: addresses.chainlinkOracle ?? null
      }
    });

    return {
      status: "indexed" as const,
      reason,
      ...result
    };
  } finally {
    if (!bypassLease) {
      await releaseIndexerLease(prisma);
    }
  }
}
