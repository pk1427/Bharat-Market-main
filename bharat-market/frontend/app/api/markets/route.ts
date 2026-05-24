import { NextResponse } from "next/server";

import { getRequiredAddresses } from "@/lib/contracts";
import {
  fetchMarketSummaries,
  serializeMarketSummary
} from "@/lib/market-data";
import {
  getCachedSummaries,
  isFresh,
  setCachedSummaries
} from "@/lib/server/market-cache";
import { getServerPublicClient } from "@/lib/server/public-client";

const SUMMARY_TTL_MS = 120_000;

async function buildMarketBoardSnapshot(marketFactory: `0x${string}`) {
  const publicClient = getServerPublicClient();
  const markets = await fetchMarketSummaries(publicClient, marketFactory);
  const payload = markets.map(serializeMarketSummary);
  await setCachedSummaries(payload);
  return payload;
}

export async function GET(request: Request) {
  const addresses = getRequiredAddresses();

  if (!addresses) {
    return NextResponse.json(
      { error: "Missing frontend env configuration." },
      { status: 500 }
    );
  }

  try {
    const requestUrl = new URL(request.url);
    const forceFresh = requestUrl.searchParams.get("fresh") === "1";
    const cached = await getCachedSummaries();
    if (!forceFresh && cached) {
      if (!isFresh(cached.updatedAt, SUMMARY_TTL_MS)) {
        void buildMarketBoardSnapshot(addresses.marketFactory).catch(() => {
          // Keep serving the last good backend snapshot if refresh fails.
        });
      }

      return NextResponse.json({
        markets: cached.data,
        stale: !isFresh(cached.updatedAt, SUMMARY_TTL_MS),
        updatedAt: cached.updatedAt,
        cached: true
      });
    }

    const payload = await buildMarketBoardSnapshot(addresses.marketFactory);

    return NextResponse.json({
      markets: payload,
      stale: false,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    const cached = await getCachedSummaries();

    if (cached) {
      return NextResponse.json({
        markets: cached.data,
        stale: true,
        updatedAt: cached.updatedAt,
        warning:
          error instanceof Error
            ? error.message
            : "RPC unavailable. Showing cached market board."
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load markets from RPC."
      },
      { status: 503 }
    );
  }
}
