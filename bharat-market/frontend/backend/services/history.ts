import { getIndexedBackend } from "@/backend/services/runtime";

type HistoryRange = "1H" | "24H" | "ALL";

export async function getIndexedMarketHistory(
  marketAddress: `0x${string}`,
  options: {
    range?: HistoryRange;
    take?: number;
  } = {}
) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const market = await prisma.market.findUnique({
    where: {
      marketAddress: marketAddress.toLowerCase()
    },
    select: {
      id: true
    }
  });

  if (!market) {
    return [];
  }

  const now = Date.now();
  const cutoff =
    options.range === "1H"
      ? new Date(now - 60 * 60 * 1000)
      : options.range === "24H"
        ? new Date(now - 24 * 60 * 60 * 1000)
        : null;

  const points = await prisma.marketSnapshot.findMany({
    where: {
      marketId: market.id,
      ...(cutoff
        ? {
            timestamp: {
              gte: cutoff
            }
          }
        : {})
    },
    orderBy: {
      timestamp: "asc"
    },
    take: options.take ?? 500
  });

  return points.map((point: (typeof points)[number]) => ({
    timestamp: point.timestamp.getTime(),
    yesProbability: point.yesProbability.toString(),
    noProbability: point.noProbability.toString(),
    volume: point.volume.toString(),
    source: "event" as const
  }));
}
