"use client";

import { useQuery } from "@tanstack/react-query";

import type { ActivityItem } from "@/types/product";

type ActivityPayload = {
  items: Array<Omit<ActivityItem, "amount" | "shares"> & { amount: string; shares?: string }>;
  error?: string;
  warning?: string;
};

export function useActivityFeed(marketAddress: string) {
  return useQuery({
    queryKey: ["activity", marketAddress],
    enabled: Boolean(marketAddress),
    queryFn: async () => {
      const response = await fetch(`/api/markets/${marketAddress}/activity`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as ActivityPayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load activity.");
      }

      return {
        items: payload.items.map((item) => ({
          ...item,
          amount: BigInt(item.amount),
          shares: item.shares ? BigInt(item.shares) : undefined
        })),
        warning: payload.warning ?? null
      };
    },
    refetchInterval: 30_000
  });
}
