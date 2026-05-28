"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchApi } from "@/services/api-client";

type IndexerStatusPayload = {
  updatedAt: string;
  freshness: {
    state: "fresh" | "stale" | "missing";
    fresh: boolean;
    updatedAt: string | null;
    ageMs: number | null;
    thresholdMs: number;
    reason: string | null;
  };
  cursors: Array<{
    name: string;
    lastIndexedBlock: string;
    updatedAt: string;
  }>;
  counts: {
    markets: number;
    snapshots: number;
    trades: number;
    liquidityEvents: number;
    redemptions: number;
    oracleEvents: number;
  };
};

export function useIndexerStatus(enabled = process.env.NODE_ENV !== "production") {
  return useQuery({
    queryKey: ["indexer-status"],
    enabled,
    queryFn: async () => fetchApi<IndexerStatusPayload>("/api/internal/indexer-status"),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false
  });
}
