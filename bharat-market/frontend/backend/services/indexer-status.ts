import { getGlobalIndexerFreshness } from "@/backend/services/indexer-freshness";
import { getIndexedBackend } from "@/backend/services/runtime";

export async function getIndexerStatus() {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const [cursors, markets, snapshots, trades, liquidityEvents, redemptions, oracleEvents] =
    await prisma.$transaction([
      prisma.indexerCursor.findMany({
        orderBy: {
          updatedAt: "desc"
        }
      }),
      prisma.market.count(),
      prisma.marketSnapshot.count(),
      prisma.trade.count(),
      prisma.liquidityEvent.count(),
      prisma.redemption.count(),
      prisma.oracleEvent.count()
    ]);
  const freshness = await getGlobalIndexerFreshness(prisma);

  return {
    updatedAt: new Date().toISOString(),
    freshness,
    cursors: cursors.map((cursor) => ({
      name: cursor.name,
      lastIndexedBlock: cursor.lastIndexedBlock.toString(),
      updatedAt: cursor.updatedAt.toISOString()
    })),
    counts: {
      markets,
      snapshots,
      trades,
      liquidityEvents,
      redemptions,
      oracleEvents
    }
  };
}
