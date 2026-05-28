import { buildApiMeta } from "@/backend/api/response";
import { NextResponse } from "next/server";

import { getIndexedMarketBoardPage } from "@/backend/services/markets";
import { getRequiredAddresses } from "@/lib/contracts";
import {
  fetchMarketSummaries,
  type MarketSummaryDto,
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

function filterMarketDtos(
  markets: MarketSummaryDto[],
  params: {
    search?: string | null;
    status?: "all" | "live" | "awaiting" | "resolved" | null;
    limit: number;
    offset: number;
  }
) {
  const searchTerm = params.search?.trim().toLowerCase() ?? "";
  const filtered = markets.filter((market) => {
    if (params.status && params.status !== "all") {
      const normalized =
        params.status === "live" ? "active" : params.status === "awaiting" ? "awaiting" : "resolved";
      if (market.status !== normalized) {
        return false;
      }
    }

    if (!searchTerm) {
      return true;
    }

    return `${market.question} ${market.category} ${market.oracleQuery}`
      .toLowerCase()
      .includes(searchTerm);
  });

  return {
    items: filtered.slice(params.offset, params.offset + params.limit),
    total: filtered.length
  };
}

export async function GET(request: Request) {
  const addresses = getRequiredAddresses();
  const requestUrl = new URL(request.url);
  const forceFresh = requestUrl.searchParams.get("fresh") === "1";
  const search = requestUrl.searchParams.get("search");
  const statusParam = requestUrl.searchParams.get("status");
  const status =
    statusParam === "live" || statusParam === "awaiting" || statusParam === "resolved" || statusParam === "all"
      ? statusParam
      : null;
  const limit = Number(requestUrl.searchParams.get("limit") ?? "100");
  const offset = Number(requestUrl.searchParams.get("offset") ?? "0");

  if (!addresses) {
    return NextResponse.json(
      { error: "Missing frontend env configuration." },
      { status: 500 }
    );
  }

  try {
    if (!forceFresh) {
      const indexedQuery = {
        search,
        status,
        take: Number.isFinite(limit) ? Math.min(limit, 100) : 100,
        skip: Number.isFinite(offset) ? Math.max(offset, 0) : 0
      } as const;
      const indexedPage = await getIndexedMarketBoardPage(indexedQuery);

      if (indexedPage) {
        return NextResponse.json({
          markets: indexedPage.markets,
          total: indexedPage.total,
          meta: buildApiMeta({
            source: "indexed",
            indexed: true,
            hasMore: offset + indexedPage.markets.length < indexedPage.total
          })
        });
      }
    }

    const cached = await getCachedSummaries();
    if (!forceFresh && cached) {
      if (!isFresh(cached.updatedAt, SUMMARY_TTL_MS)) {
        void buildMarketBoardSnapshot(addresses.marketFactory).catch(() => {
          // Keep serving the last good backend snapshot if refresh fails.
        });
      }

      const filtered = filterMarketDtos(cached.data, {
        search,
        status,
        limit: Number.isFinite(limit) ? Math.min(limit, 100) : 100,
        offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0
      });

      return NextResponse.json({
        markets: filtered.items,
        total: filtered.total,
        meta: buildApiMeta({
          source: "cache",
          stale: !isFresh(cached.updatedAt, SUMMARY_TTL_MS),
          updatedAt: cached.updatedAt,
          fallbackUsed: true,
          hasMore: offset + filtered.items.length < filtered.total
        })
      });
    }

    const payload = await buildMarketBoardSnapshot(addresses.marketFactory);
    const filtered = filterMarketDtos(payload, {
      search,
      status,
      limit: Number.isFinite(limit) ? Math.min(limit, 100) : 100,
      offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0
    });

    return NextResponse.json({
      markets: filtered.items,
      total: filtered.total,
      meta: buildApiMeta({
        source: "rpc",
        hasMore: offset + filtered.items.length < filtered.total
      })
    });
  } catch (error) {
    const cached = await getCachedSummaries();

    if (cached) {
      const filtered = filterMarketDtos(cached.data, {
        search,
        status,
        limit: Number.isFinite(limit) ? Math.min(limit, 100) : 100,
        offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0
      });

      return NextResponse.json({
        markets: filtered.items,
        total: filtered.total,
        meta: buildApiMeta({
          source: "cache",
          stale: true,
          updatedAt: cached.updatedAt,
          warning:
            error instanceof Error
              ? error.message
              : "RPC unavailable. Showing cached market board.",
          fallbackUsed: true,
          hasMore: offset + filtered.items.length < filtered.total
        })
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
