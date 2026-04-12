import { NextResponse } from "next/server";

import { getRequiredAddresses } from "@/lib/contracts";
import {
  fetchMarketSummaries,
  serializeMarketSummary
} from "@/lib/market-data";
import { getCachedSummaries, setCachedSummaries } from "@/lib/server/market-cache";
import { getServerPublicClient } from "@/lib/server/public-client";

export async function GET() {
  const addresses = getRequiredAddresses();

  if (!addresses) {
    return NextResponse.json(
      { error: "Missing frontend env configuration." },
      { status: 500 }
    );
  }

  try {
    const publicClient = getServerPublicClient();
    const markets = await fetchMarketSummaries(publicClient, addresses.marketFactory);
    const payload = markets.map(serializeMarketSummary);

    await setCachedSummaries(payload);

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
