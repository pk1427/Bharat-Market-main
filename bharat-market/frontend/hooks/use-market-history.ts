"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { loadMarketHistory, mergeMarketHistory } from "@/lib/history";
import type { MarketDetailData } from "@/lib/market-data";
import { fetchApi } from "@/services/api-client";
import type { ApiMeta } from "@/types/product";
import type { HistoryPoint } from "@/types/product";

type HistoryPayload = {
  points: Array<{
    timestamp: number;
    yesProbability: string;
    noProbability: string;
    volume: string;
    source: HistoryPoint["source"];
  }>;
  meta?: ApiMeta;
};

export function useMarketHistory(market: MarketDetailData | null, range: "1H" | "24H" | "ALL" = "ALL") {
  const localHistory = useMemo(() => {
    if (!market) {
      return [];
    }

    return loadMarketHistory(market.address);
  }, [market]);

  const query = useQuery({
    queryKey: ["market-history", market?.address, range],
    enabled: Boolean(market?.address),
    queryFn: async () => {
      const payload = await fetchApi<HistoryPayload>(`/api/markets/${market?.address}/history?range=${range}`);

      return {
        points: payload.points.map((point) => ({
          ...point,
          yesProbability: BigInt(point.yesProbability),
          noProbability: BigInt(point.noProbability),
          volume: BigInt(point.volume)
        })) satisfies HistoryPoint[],
        meta: payload.meta ?? null
      };
    },
    staleTime: 20_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false
  });

  const rawHistory = query.data?.points ?? [];
  const history = useMemo(
    () =>
      filterHistoryByRange(
        query.data?.meta?.source === "indexed"
          ? rawHistory
          : mergeMarketHistory(rawHistory, localHistory),
        range
      ),
    [localHistory, query.data?.meta?.source, range, rawHistory]
  );

  return {
    ...query,
    history,
    warning: query.data?.meta?.warning ?? null,
    meta: query.data?.meta ?? null
  };
}

function filterHistoryByRange(points: HistoryPoint[], range: "1H" | "24H" | "ALL") {
  if (range === "ALL") {
    return points;
  }

  const now = Date.now();
  const cutoff = range === "1H" ? now - 60 * 60 * 1000 : now - 24 * 60 * 60 * 1000;
  return points.filter((point) => point.timestamp >= cutoff);
}
