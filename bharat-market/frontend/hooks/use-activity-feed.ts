"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchApi } from "@/services/api-client";
import type { ApiMeta } from "@/types/product";
import type { ActivityItem } from "@/types/product";

type ActivityPayload = {
  items: Array<Omit<ActivityItem, "amount" | "shares"> & { amount: string; shares?: string }>;
  meta?: ApiMeta;
};

export function useActivityFeed(marketAddress: string) {
  return useInfiniteQuery({
    queryKey: ["activity", marketAddress],
    enabled: Boolean(marketAddress),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : "";
      const payload = await fetchApi<ActivityPayload>(
        `/api/markets/${marketAddress}/activity?limit=40${cursor}`
      );

      return {
        items: payload.items.map((item) => ({
          ...item,
          amount: BigInt(item.amount),
          shares: item.shares ? BigInt(item.shares) : undefined
        })),
        meta: payload.meta ?? null
      };
    },
    getNextPageParam: (lastPage) => lastPage.meta?.cursor ?? undefined,
    maxPages: 3,
    staleTime: 20_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false
  });
}
