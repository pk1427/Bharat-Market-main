"use client";

import { useMemo } from "react";

import { usePortfolio } from "@/hooks/use-portfolio";

export function useRedeemable() {
  const portfolio = usePortfolio();

  return useMemo(
    () => ({
      ...portfolio,
      redeemable:
        portfolio.data?.groups.filter((group) => group.redeemableTotal > 0n) ?? []
    }),
    [portfolio]
  );
}
