"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { loadMarketHistory, mergeMarketHistory } from "@/lib/history";
import type { MarketDetailData } from "@/lib/market-data";
import type { HistoryPoint } from "@/types/product";

type HistoryPayload = {
  points: Array<{
    timestamp: number;
    yesProbability: string;
    noProbability: string;
    volume: string;
    source: HistoryPoint["source"];
  }>;
  error?: string;
  warning?: string;
};

export function useMarketHistory(market: MarketDetailData | null) {
  const localHistory = useMemo(() => {
    if (!market) {
      return [];
    }

    return loadMarketHistory(market.address);
  }, [market]);

  const query = useQuery({
    queryKey: ["market-history", market?.address],
    enabled: Boolean(market?.address),
    queryFn: async () => {
      const response = await fetch(`/api/markets/${market?.address}/history`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as HistoryPayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load market history.");
      }

      return {
        points: payload.points.map((point) => ({
          ...point,
          yesProbability: BigInt(point.yesProbability),
          noProbability: BigInt(point.noProbability),
          volume: BigInt(point.volume)
        })) satisfies HistoryPoint[],
        warning: payload.warning ?? null
      };
    },
    refetchInterval: 30_000
  });

  const history = useMemo(
    () => mergeMarketHistory(query.data?.points ?? [], localHistory),
    [localHistory, query.data?.points]
  );

  return {
    ...query,
    history,
    warning: query.data?.warning ?? null
  };
}
