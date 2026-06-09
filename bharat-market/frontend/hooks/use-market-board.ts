"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  deserializeMarketSummary,
  type MarketSummary,
  type MarketSummaryDto
} from "@/lib/market-data";
import { fetchApi } from "@/services/api-client";
import type { ApiMeta } from "@/types/product";

export function useMarketBoard({
  externalRefreshTick = 0,
  enabled = true,
  search = "",
  status = "all",
  limit = 100,
  offset = 0
}: {
  externalRefreshTick?: number;
  enabled?: boolean;
  search?: string;
  status?: "all" | "active" | "awaiting" | "resolved";
  limit?: number;
  offset?: number;
} = {}) {
  const previousExternalTick = useRef(externalRefreshTick);
  const forceFreshRef = useRef(false);

  const query = useQuery({
    queryKey: ["market-board", search, status, limit, offset],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (forceFreshRef.current) {
        params.set("fresh", "1");
      }
      forceFreshRef.current = false;
      if (search.trim()) {
        params.set("search", search.trim());
      }
      if (status !== "all") {
        params.set("status", status === "active" ? "live" : status);
      }
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      const payload = await fetchApi<{
        markets: MarketSummaryDto[];
        total?: number;
        meta?: ApiMeta;
      }>(`/api/markets?${params.toString()}`);

      return {
        markets: payload.markets.map(deserializeMarketSummary),
        total: payload.total ?? payload.markets.length,
        meta: payload.meta ?? null
      };
    },
    placeholderData: (previousData) => previousData,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true
  });

  const refresh = useCallback(() => {
    forceFreshRef.current = true;
    void query.refetch();
  }, [query]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (externalRefreshTick === previousExternalTick.current) {
      return;
    }

    previousExternalTick.current = externalRefreshTick;
    void query.refetch();
  }, [enabled, externalRefreshTick, query]);

  return {
    markets: query.data?.markets ?? [],
    total: query.data?.total ?? 0,
    loading: enabled ? query.isLoading : false,
    error: query.error instanceof Error ? query.error.message : null,
    warning: query.data?.meta?.warning ?? null,
    meta: query.data?.meta ?? null,
    refresh
  };
}
