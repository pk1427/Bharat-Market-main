"use client";

import { useQuery } from "@tanstack/react-query";

import { deserializeMarketSummary, type MarketSummary, type MarketSummaryDto } from "@/lib/market-data";
import { fetchApi } from "@/services/api-client";
import type { ApiMeta } from "@/types/product";

type AnalyticsPayload = {
  markets: MarketSummaryDto[];
  meta?: ApiMeta;
};

async function fetchBoardSlice(endpoint: string) {
  const payload = await fetchApi<AnalyticsPayload>(endpoint);
  return {
    markets: payload.markets.map(deserializeMarketSummary),
    meta: payload.meta ?? null
  };
}

export function useBoardAnalytics() {
  const topMovers = useQuery({
    queryKey: ["board-analytics", "top-movers"],
    queryFn: () => fetchBoardSlice("/api/top-movers?limit=6"),
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false
  });

  const trending = useQuery({
    queryKey: ["board-analytics", "trending"],
    queryFn: () => fetchBoardSlice("/api/trending-markets?limit=6"),
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false
  });

  return {
    topMovers: topMovers.data?.markets ?? ([] as MarketSummary[]),
    trending: trending.data?.markets ?? ([] as MarketSummary[]),
    topMoversMeta: topMovers.data?.meta ?? null,
    trendingMeta: trending.data?.meta ?? null
  };
}
