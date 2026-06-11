import { erc20Abi, getAddress } from "viem";

import { calculateProbabilityMove } from "@/backend/analytics/markets";
import { getIndexedBackend } from "@/backend/services/runtime";
import {
  getMarketStatus,
  getStatusLabel,
  toMarketDetailDto,
  toMarketSummaryDto
} from "@/backend/services/serializers";
import { getRequiredAddresses } from "@/lib/contracts";
import type { MarketDetailDto, MarketSummaryDto } from "@/lib/market-data";
import { getServerPublicClient } from "@/lib/server/public-client";

export type MarketQuery = {
  search?: string | null;
  status?: "all" | "live" | "awaiting" | "resolved" | null;
  take?: number;
  skip?: number;
};

function buildMarketWhere(query: MarketQuery) {
  const now = new Date();
  const where: {
    OR?: Array<{
      question?: { contains: string; mode: "insensitive" };
      oracleQuery?: { contains: string; mode: "insensitive" };
      oracleType?: { contains: string; mode: "insensitive" };
    }>;
    resolved?: boolean;
    endTime?: { gt?: Date; lte?: Date };
  } = {};

  if (query.search) {
    where.OR = [
      {
        question: {
          contains: query.search,
          mode: "insensitive"
        }
      },
      {
        oracleQuery: {
          contains: query.search,
          mode: "insensitive"
        }
      },
      {
        oracleType: {
          contains: query.search,
          mode: "insensitive"
        }
      }
    ];
  }

  if (query.status === "live") {
    where.resolved = false;
    where.endTime = { gt: now };
  } else if (query.status === "awaiting") {
    where.resolved = false;
    where.endTime = { lte: now };
  } else if (query.status === "resolved") {
    where.resolved = true;
  }

  return where;
}

export async function listIndexedMarkets(query: MarketQuery = {}) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const markets = await prisma.market.findMany({
    where: buildMarketWhere(query),
    orderBy: [
      { resolved: "asc" },
      { endTime: "asc" },
      { totalVolume: "desc" },
      { totalLiquidity: "desc" }
    ],
    take: query.take ?? 100,
    skip: query.skip ?? 0
  });

  if (markets.length === 0) {
    return [];
  }

  return markets.map(toMarketSummaryDto);
}

export async function countIndexedMarkets(query: MarketQuery = {}) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  return prisma.market.count({
    where: buildMarketWhere(query)
  });
}

export async function getIndexedMarketBoardPage(query: MarketQuery = {}) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const where = buildMarketWhere(query);
  const [markets, total] = await prisma.$transaction([
    prisma.market.findMany({
      where,
      orderBy: [
        { resolved: "asc" },
        { endTime: "asc" },
        { totalVolume: "desc" },
        { totalLiquidity: "desc" }
      ],
      take: query.take ?? 100,
      skip: query.skip ?? 0
    }),
    prisma.market.count({
      where
    })
  ]);

  return {
    markets: markets.map(toMarketSummaryDto),
    total
  };
}

export async function getIndexedMarketDetail(
  marketAddress: `0x${string}`,
  account?: `0x${string}`
): Promise<{ market: MarketDetailDto; pendingRequest: string | null } | null> {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const market = await prisma.market.findUnique({
    where: {
      marketAddress: marketAddress.toLowerCase()
    }
  });

  if (!market) {
    return null;
  }

  let yesBalance = 0n;
  let noBalance = 0n;
  let lpBalance = 0n;
  let usdcBalance = 0n;

  if (account) {
    const wallet = account.toLowerCase();
    const [yesPosition, noPosition, lpPosition, redeemedAggregate] = await Promise.all([
      prisma.walletPosition.findUnique({
        where: {
          wallet_marketId_side: {
            wallet,
            marketId: market.id,
            side: "YES"
          }
        }
      }),
      prisma.walletPosition.findUnique({
        where: {
          wallet_marketId_side: {
            wallet,
            marketId: market.id,
            side: "NO"
          }
        }
      }),
      prisma.walletLiquidityPosition.findUnique({
        where: {
          wallet_marketId: {
            wallet,
            marketId: market.id
          }
        }
      }),
      prisma.redemption.aggregate({
        where: {
          marketId: market.id,
          redeemer: wallet
        },
        _sum: {
          payoutAmount: true
        }
      })
    ]);

    const redeemedPayout = redeemedAggregate._sum.payoutAmount ?? 0n;
    yesBalance = reconcileRedeemedShares(
      yesPosition?.shares ?? 0n,
      market.outcome === "YES" ? redeemedPayout : 0n,
      yesPosition?.redeemedAmount ?? 0n
    );
    noBalance = reconcileRedeemedShares(
      noPosition?.shares ?? 0n,
      market.outcome === "NO" ? redeemedPayout : 0n,
      noPosition?.redeemedAmount ?? 0n
    );
    lpBalance = lpPosition?.lpTokens ?? 0n;

    const addresses = getRequiredAddresses();
    if (addresses) {
      try {
        usdcBalance = await getServerPublicClient().readContract({
          address: addresses.usdc,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [getAddress(account)]
        });
      } catch {
        usdcBalance = 0n;
      }
    }
  }

  const latestRequest = await prisma.oracleEvent.findFirst({
    where: {
      marketId: market.id,
      type: "REQUESTED"
    },
    orderBy: {
      timestamp: "desc"
    }
  });

  const pendingRequest =
    latestRequest?.requestId &&
    !(await prisma.oracleEvent.findFirst({
      where: {
        marketId: market.id,
        requestId: latestRequest.requestId,
        type: {
          in: ["FULFILLED", "FAILED"]
        }
      }
    }))
      ? latestRequest.requestId
      : null;

  return {
    market: toMarketDetailDto({
      market,
      account: {
        yesBalance,
        noBalance,
        lpBalance,
        usdcBalance
      }
    }),
    pendingRequest
  };
}

function reconcileRedeemedShares(shares: bigint, totalRedeemed: bigint, indexedRedeemed: bigint) {
  const unindexedRedeemed = totalRedeemed > indexedRedeemed ? totalRedeemed - indexedRedeemed : 0n;
  return shares > unindexedRedeemed ? shares - unindexedRedeemed : 0n;
}

export async function listTopMovers(limit = 10) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const markets = await prisma.market.findMany({
    take: limit * 3,
    orderBy: {
      lastActivityAt: "desc"
    },
    include: {
      snapshots: {
        take: 2,
        orderBy: {
          timestamp: "desc"
        }
      }
    }
  });

  const movers = markets
    .map((market: (typeof markets)[number]) => {
      const [latest, previous] = market.snapshots;
      const move =
        latest && previous ? calculateProbabilityMove(latest.yesProbability, previous.yesProbability) : 0n;

      return {
        ...toMarketSummaryDto(market),
        move: move.toString()
      };
    })
    .sort((left: { move: string }, right: { move: string }) => {
      const leftMove = BigInt(left.move);
      const rightMove = BigInt(right.move);
      if (leftMove === rightMove) {
        return 0;
      }

      return rightMove > leftMove ? 1 : -1;
    })
    .slice(0, limit);

  return movers;
}

export async function listTrendingMarkets(limit = 10) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const markets = await prisma.market.findMany({
    take: limit,
    orderBy: [
      { totalVolume: "desc" },
      { traderCount: "desc" },
      { lastActivityAt: "desc" }
    ]
  });

  return markets.map(toMarketSummaryDto);
}

export function getIndexedMarketPresentation(market: {
  resolved: boolean;
  endTime: Date;
}) {
  const status = getMarketStatus(market.resolved, market.endTime);
  return {
    status,
    statusLabel: getStatusLabel(status)
  };
}
