import { buildApiMeta } from "@/backend/api/response";
import {
  INDEXED_ONLY_WARNING,
  isDashboardRpcFallbackAllowed
} from "@/backend/api/rpc-fallback";
import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

import { getIndexedMarketHistory } from "@/backend/services/history";
import { getRequiredAddresses } from "@/lib/contracts";
import { fetchMarketHistoryFromEvents } from "@/lib/event-indexer";
import {
  getCachedHistory,
  isFresh,
  setCachedHistory
} from "@/lib/server/market-cache";
import { getServerPublicClient } from "@/lib/server/public-client";

const HISTORY_TTL_MS = 180_000;

async function buildMarketHistorySnapshot(
  marketFactory: `0x${string}`,
  marketAddress: `0x${string}`
) {
  const publicClient = getServerPublicClient();
  const points = await fetchMarketHistoryFromEvents(publicClient, marketFactory, marketAddress);
  const payload = points.map((point) => ({
    ...point,
    yesProbability: point.yesProbability.toString(),
    noProbability: point.noProbability.toString(),
    volume: point.volume.toString()
  }));

  await setCachedHistory(marketAddress, payload);
  return payload;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const addresses = getRequiredAddresses();

  if (!addresses) {
    return NextResponse.json({ error: "Missing frontend env configuration." }, { status: 500 });
  }

  try {
    const { address } = await context.params;
    const marketAddress = getAddress(address);
    const forceFresh = request.nextUrl.searchParams.get("fresh") === "1";
    const allowRpcFallback = isDashboardRpcFallbackAllowed(request);
    const range = (request.nextUrl.searchParams.get("range") ?? "ALL") as "1H" | "24H" | "ALL";
    const indexedHistory = await getIndexedMarketHistory(marketAddress, {
      range
    });
    if (indexedHistory && indexedHistory.length > 0) {
      return NextResponse.json({
        points: indexedHistory,
        meta: buildApiMeta({
          source: "indexed",
          indexed: true,
          range
        })
      });
    }

    const cached = await getCachedHistory(marketAddress);
    if (!forceFresh && cached) {
      if (allowRpcFallback && !isFresh(cached.updatedAt, HISTORY_TTL_MS)) {
        void buildMarketHistorySnapshot(addresses.marketFactory, marketAddress).catch(() => {
          // Keep serving the last good backend history snapshot if refresh fails.
        });
      }

      return NextResponse.json({
        points: cached.data,
        meta: buildApiMeta({
          source: "cache",
          stale: !isFresh(cached.updatedAt, HISTORY_TTL_MS),
          updatedAt: cached.updatedAt,
          fallbackUsed: true,
          range
        })
      });
    }

    if (!allowRpcFallback) {
      return NextResponse.json({
        points: [],
        meta: buildApiMeta({
          source: "indexed",
          indexed: true,
          stale: true,
          warning: INDEXED_ONLY_WARNING,
          range
        })
      });
    }

    const payload = await buildMarketHistorySnapshot(addresses.marketFactory, marketAddress);

    return NextResponse.json({
      points: payload,
      meta: buildApiMeta({
        source: "rpc",
        range
      })
    });
  } catch (error) {
    const { address } = await context.params;
    const marketAddress = getAddress(address);
    const cached = await getCachedHistory(marketAddress);
    if (cached) {
      return NextResponse.json({
        points: cached.data,
        meta: buildApiMeta({
          source: "cache",
          stale: true,
          updatedAt: cached.updatedAt,
          warning:
            error instanceof Error
              ? error.message
              : "Failed to load market history.",
          fallbackUsed: true
        })
      });
    }

    return NextResponse.json({
      points: [],
      meta: buildApiMeta({
        source: "indexed",
        indexed: true,
        stale: true,
        warning:
          error instanceof Error
            ? error.message
            : INDEXED_ONLY_WARNING
      })
    });
  }
}
