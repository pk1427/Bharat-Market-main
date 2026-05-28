import type { PrismaClient } from "@prisma/client";

import { getIndexedBackend } from "@/backend/services/runtime";

const INDEXER_FRESHNESS_MS = Number(process.env.INDEXER_FRESHNESS_MS ?? "300000");

export type IndexerFreshness = {
  state: "fresh" | "stale" | "missing";
  fresh: boolean;
  updatedAt: string | null;
  ageMs: number | null;
  thresholdMs: number;
  reason: string | null;
};

function toFreshness(updatedAt: Date | null, reason?: string | null): IndexerFreshness {
  if (!updatedAt) {
    return {
      state: "missing",
      fresh: false,
      updatedAt: null,
      ageMs: null,
      thresholdMs: INDEXER_FRESHNESS_MS,
      reason: reason ?? "No indexer cursor is available yet."
    };
  }

  const ageMs = Date.now() - updatedAt.getTime();
  const fresh = ageMs <= INDEXER_FRESHNESS_MS;

  return {
    state: fresh ? "fresh" : "stale",
    fresh,
    updatedAt: updatedAt.toISOString(),
    ageMs,
    thresholdMs: INDEXER_FRESHNESS_MS,
    reason:
      fresh
        ? null
        : reason ?? "Indexed backend is behind live chain activity, so RPC/cache fallback is being used."
  };
}

async function findLatestCursor(prisma: PrismaClient, names?: string[]) {
  return prisma.indexerCursor.findFirst({
    where: names?.length
      ? {
          name: {
            in: names
          }
        }
      : undefined,
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function getGlobalIndexerFreshness(prismaArg?: PrismaClient | null) {
  const prisma = prismaArg ?? getIndexedBackend();
  if (!prisma) {
    return toFreshness(null, "Indexed backend is not configured.");
  }

  const latestCursor = await findLatestCursor(prisma);
  return toFreshness(latestCursor?.updatedAt ?? null);
}

export async function getMarketIndexerFreshness(
  marketAddress: `0x${string}` | string,
  prismaArg?: PrismaClient | null
) {
  const prisma = prismaArg ?? getIndexedBackend();
  if (!prisma) {
    return toFreshness(null, "Indexed backend is not configured.");
  }

  const marketCursorName = `market:${marketAddress.toLowerCase()}`;
  const latestCursor = await findLatestCursor(prisma, [marketCursorName]);

  return toFreshness(
    latestCursor?.updatedAt ?? null,
    `Indexed event sync for ${marketAddress.slice(0, 8)} is stale, so BharatMarket is falling back to cache/RPC data.`
  );
}

export async function getPortfolioIndexerFreshness(prismaArg?: PrismaClient | null) {
  const prisma = prismaArg ?? getIndexedBackend();
  if (!prisma) {
    return toFreshness(null, "Indexed backend is not configured.");
  }

  const latestCursor = await findLatestCursor(prisma);
  return toFreshness(
    latestCursor?.updatedAt ?? null,
    "Portfolio indexing is stale, so BharatMarket is falling back to cache/RPC wallet state."
  );
}
