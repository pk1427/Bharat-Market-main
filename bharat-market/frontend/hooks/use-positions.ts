"use client";

import { useMemo } from "react";

import { usePortfolio } from "@/hooks/use-portfolio";

export function usePositions() {
  const portfolio = usePortfolio();

  return useMemo(
    () => ({
      ...portfolio,
      positions: portfolio.data?.groups.flatMap((group) => group.positions) ?? []
    }),
    [portfolio]
  );
}
