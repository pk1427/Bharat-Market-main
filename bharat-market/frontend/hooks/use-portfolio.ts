"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { fetchApi } from "@/services/api-client";
import type { ApiMeta } from "@/types/product";
import type { PortfolioGroup, PortfolioOverview, PortfolioPosition } from "@/types/product";

type PortfolioPayload = {
  overview: {
    walletUsdcBalance: string;
    yesHoldings: string;
    noHoldings: string;
    lpHoldings: string;
    redeemableWinnings: string;
    activePositions: number;
    estimatedPositionValue: string;
    unrealizedPnl: string;
  };
  groups: Array<{
    marketAddress: `0x${string}`;
    question: string;
    status: PortfolioGroup["status"];
    statusLabel: string;
    category: string;
    oracleType: string;
    redeemableTotal: string;
    positions: Array<{
      marketAddress: `0x${string}`;
      question: string;
      status: PortfolioPosition["status"];
      statusLabel: string;
      side: PortfolioPosition["side"];
      shares: string;
      averageEntryPrice: string | null;
      currentProbability: string;
      estimatedValue: string;
      unrealizedPnl: string;
      redeemable: string;
      liquidityValue?: string | null;
      oracleType: string;
      category: string;
    }>;
  }>;
  updatedAt: string;
  meta?: ApiMeta;
};

function deserializePortfolio(payload: PortfolioPayload): {
  overview: PortfolioOverview;
  groups: PortfolioGroup[];
  updatedAt: string;
  meta?: ApiMeta | null;
} {
  return {
    overview: {
      walletUsdcBalance: BigInt(payload.overview.walletUsdcBalance),
      yesHoldings: BigInt(payload.overview.yesHoldings),
      noHoldings: BigInt(payload.overview.noHoldings),
      lpHoldings: BigInt(payload.overview.lpHoldings),
      redeemableWinnings: BigInt(payload.overview.redeemableWinnings),
      activePositions: payload.overview.activePositions,
      estimatedPositionValue: BigInt(payload.overview.estimatedPositionValue),
      unrealizedPnl: BigInt(payload.overview.unrealizedPnl)
    },
    groups: payload.groups.map((group) => ({
      ...group,
      redeemableTotal: BigInt(group.redeemableTotal),
      positions: group.positions.map((position) => ({
        ...position,
        shares: BigInt(position.shares),
        averageEntryPrice: position.averageEntryPrice ? BigInt(position.averageEntryPrice) : null,
        currentProbability: BigInt(position.currentProbability),
        estimatedValue: BigInt(position.estimatedValue),
        unrealizedPnl: BigInt(position.unrealizedPnl),
        redeemable: BigInt(position.redeemable),
        liquidityValue: position.liquidityValue ? BigInt(position.liquidityValue) : undefined
      }))
    })),
    updatedAt: payload.updatedAt,
    meta: payload.meta ?? null
  };
}

export function usePortfolio() {
  const { address } = useAccount();
  const enabled = Boolean(address);

  const query = useQuery({
    queryKey: ["portfolio", address],
    enabled,
    queryFn: async () => {
      const payload = await fetchApi<PortfolioPayload>(`/api/portfolio?account=${address}`);

      return deserializePortfolio(payload);
    },
    staleTime: 30_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false
  });

  return {
    ...query,
    isEnabled: enabled
  };
}
