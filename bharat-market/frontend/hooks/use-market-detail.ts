"use client";

import { useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { fetchApi } from "@/services/api-client";
import type { ApiMeta } from "@/types/product";
import {
  deserializeMarketDetail,
  type MarketDetailData,
  type MarketDetailDto
} from "@/lib/market-data";

type MarketDetailPayload = {
  market: MarketDetailDto;
  pendingRequest?: `0x${string}` | null;
  meta?: ApiMeta;
};

export function useMarketDetail(address: string | null) {
  const { address: account } = useAccount();
  const forceFreshRef = useRef(false);

  const query = useQuery({
    queryKey: ["market-detail", address, account],
    enabled: Boolean(address),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (forceFreshRef.current) {
        params.set("fresh", "1");
      }
      forceFreshRef.current = false;

      if (account) {
        params.set("account", account);
      }

      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      const payload = await fetchApi<MarketDetailPayload>(`/api/markets/${address}${suffix}`);

      return {
        market: deserializeMarketDetail(payload.market),
        pendingRequest: payload.pendingRequest ?? null,
        meta: payload.meta ?? null
      };
    },
    staleTime: 15_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false
  });

  const refresh = useCallback(
    async (forceFresh = false) => {
      forceFreshRef.current = forceFresh;
      await query.refetch();
    },
    [query]
  );

  return {
    market: (query.data?.market ?? null) as MarketDetailData | null,
    pendingRequest: query.data?.pendingRequest ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    warning: query.data?.meta?.warning ?? null,
    meta: query.data?.meta ?? null,
    refresh
  };
}
