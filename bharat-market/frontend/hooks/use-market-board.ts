"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  deserializeMarketSummary,
  type MarketSummary,
  type MarketSummaryDto
} from "@/lib/market-data";

export function useMarketBoard({
  externalRefreshTick = 0,
  enabled = true
}: {
  externalRefreshTick?: number;
  enabled?: boolean;
} = {}) {
  const previousExternalTick = useRef(externalRefreshTick);
  const forceFreshRef = useRef(false);

  const query = useQuery({
    queryKey: ["market-board"],
    enabled,
    queryFn: async () => {
      const search = forceFreshRef.current ? "?fresh=1" : "";
      forceFreshRef.current = false;
      const response = await fetch(`/api/markets${search}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as {
        markets?: MarketSummaryDto[];
        error?: string;
        warning?: string;
      };

      if (!response.ok || !payload.markets) {
        throw new Error(payload.error ?? "Failed to load markets.");
      }

      return {
        markets: payload.markets.map(deserializeMarketSummary),
        warning: payload.warning ?? null
      };
    },
    staleTime: 20_000,
    refetchInterval: 45_000
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
    loading: enabled ? query.isLoading : false,
    error: query.error instanceof Error ? query.error.message : null,
    warning: query.data?.warning ?? null,
    refresh
  };
}
