import { getIndexedBackend } from "@/backend/services/runtime";

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function buildRevision(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => part ?? "null").join(":");
}

export async function getBoardLiveState() {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const [markets, snapshots, trades, oracleEvents, latestSnapshot, latestTrade, latestOracle, latestMarket] =
    await prisma.$transaction([
      prisma.market.count(),
      prisma.marketSnapshot.count(),
      prisma.trade.count(),
      prisma.oracleEvent.count(),
      prisma.marketSnapshot.findFirst({
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      }),
      prisma.trade.findFirst({
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      }),
      prisma.oracleEvent.findFirst({
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      }),
      prisma.market.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, lastActivityAt: true }
      })
    ]);

  const latestUpdate =
    latestSnapshot?.timestamp ??
    latestTrade?.timestamp ??
    latestOracle?.timestamp ??
    latestMarket?.lastActivityAt ??
    latestMarket?.createdAt ??
    new Date();

  return {
    scope: "board" as const,
    revision: buildRevision([
      markets,
      snapshots,
      trades,
      oracleEvents,
      toIso(latestSnapshot?.timestamp),
      toIso(latestTrade?.timestamp),
      toIso(latestOracle?.timestamp),
      toIso(latestMarket?.lastActivityAt ?? latestMarket?.createdAt)
    ]),
    updatedAt: latestUpdate.toISOString()
  };
}

export async function getMarketLiveState(marketAddress: string) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const market = await prisma.market.findUnique({
    where: {
      marketAddress: marketAddress.toLowerCase()
    },
    select: {
      id: true,
      lastActivityAt: true,
      latestYesProbability: true,
      latestNoProbability: true,
      totalLiquidity: true,
      totalVolume: true
    }
  });

  if (!market) {
    return null;
  }

  const [latestSnapshot, latestTrade, latestLiquidity, latestRedemption, latestOracle] =
    await prisma.$transaction([
      prisma.marketSnapshot.findFirst({
        where: { marketId: market.id },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      }),
      prisma.trade.findFirst({
        where: { marketId: market.id },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      }),
      prisma.liquidityEvent.findFirst({
        where: { marketId: market.id },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      }),
      prisma.redemption.findFirst({
        where: { marketId: market.id },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      }),
      prisma.oracleEvent.findFirst({
        where: { marketId: market.id },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      })
    ]);

  const latestUpdate =
    latestSnapshot?.timestamp ??
    latestTrade?.timestamp ??
    latestLiquidity?.timestamp ??
    latestRedemption?.timestamp ??
    latestOracle?.timestamp ??
    market.lastActivityAt ??
    new Date();

  return {
    scope: "market" as const,
    revision: buildRevision([
      market.id,
      market.latestYesProbability.toString(),
      market.latestNoProbability.toString(),
      market.totalLiquidity.toString(),
      market.totalVolume.toString(),
      toIso(latestSnapshot?.timestamp),
      toIso(latestTrade?.timestamp),
      toIso(latestLiquidity?.timestamp),
      toIso(latestRedemption?.timestamp),
      toIso(latestOracle?.timestamp),
      toIso(market.lastActivityAt)
    ]),
    updatedAt: latestUpdate.toISOString()
  };
}

export async function getPortfolioLiveState(wallet: string) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const normalizedWallet = wallet.toLowerCase();
  const [positions, liquidityPositions, latestPortfolioSnapshot, latestRedemption] =
    await prisma.$transaction([
      prisma.walletPosition.findFirst({
        where: { wallet: normalizedWallet },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true }
      }),
      prisma.walletLiquidityPosition.findFirst({
        where: { wallet: normalizedWallet },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true }
      }),
      prisma.portfolioSnapshot.findFirst({
        where: { wallet: normalizedWallet },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true, totalValue: true, unrealizedPnl: true }
      }),
      prisma.redemption.findFirst({
        where: { redeemer: normalizedWallet },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true }
      })
    ]);

  const latestUpdate =
    latestPortfolioSnapshot?.timestamp ??
    positions?.updatedAt ??
    liquidityPositions?.updatedAt ??
    latestRedemption?.timestamp ??
    new Date();

  return {
    scope: "portfolio" as const,
    revision: buildRevision([
      normalizedWallet,
      toIso(latestPortfolioSnapshot?.timestamp),
      latestPortfolioSnapshot?.totalValue?.toString(),
      latestPortfolioSnapshot?.unrealizedPnl?.toString(),
      toIso(positions?.updatedAt),
      toIso(liquidityPositions?.updatedAt),
      toIso(latestRedemption?.timestamp)
    ]),
    updatedAt: latestUpdate.toISOString()
  };
}
