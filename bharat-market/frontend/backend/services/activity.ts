import type { ActivityItem, ActivityType } from "@/types/product";
import { getIndexedBackend } from "@/backend/services/runtime";
import { serializeActivityItem } from "@/backend/services/serializers";

export async function getIndexedMarketActivity(
  marketAddress: `0x${string}`,
  options: {
    limit?: number;
    cursor?: string | null;
  } = {}
) {
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
    return {
      items: [],
      nextCursor: null
    };
  }

  const limit = options.limit ?? 100;
  const cursorTimestamp = options.cursor ? Number(options.cursor) : null;
  const cursorFilter =
    cursorTimestamp !== null && Number.isFinite(cursorTimestamp)
      ? {
          timestamp: {
            lt: new Date(cursorTimestamp)
          }
        }
      : {};

  const [trades, liquidityEvents, redemptions, oracleEvents] = await Promise.all([
    prisma.trade.findMany({
      where: { marketId: market.id, ...cursorFilter },
      orderBy: { timestamp: "desc" },
      take: limit
    }),
    prisma.liquidityEvent.findMany({
      where: { marketId: market.id, ...cursorFilter },
      orderBy: { timestamp: "desc" },
      take: limit
    }),
    prisma.redemption.findMany({
      where: { marketId: market.id, ...cursorFilter },
      orderBy: { timestamp: "desc" },
      take: limit
    }),
    prisma.oracleEvent.findMany({
      where: { marketId: market.id, ...cursorFilter },
      orderBy: { timestamp: "desc" },
      take: limit
    })
  ]);

  const items: ActivityItem[] = [];

  items.push({
    id: `created-${market.marketAddress}`,
    txHash: (market.createdTxHash ??
      "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`,
    marketAddress: market.marketAddress as `0x${string}`,
    question: market.question,
    actor: (market.creator ?? market.marketAddress) as `0x${string}`,
    type: "market_created",
    amount: 0n,
    timestamp: market.createdAt.getTime(),
    whale: false
  });

  for (const trade of trades) {
    items.push({
      id: trade.eventKey,
      txHash: trade.txHash as `0x${string}`,
      marketAddress: market.marketAddress as `0x${string}`,
      question: market.question,
      actor: trade.trader as `0x${string}`,
      type: trade.side === "YES" ? "buy_yes" : "buy_no",
      amount: trade.collateralAmount,
      shares: trade.sharesReceived,
      timestamp: trade.timestamp.getTime(),
      whale: trade.collateralAmount >= 100_000_000n
    });
  }

  for (const event of liquidityEvents) {
    const type: ActivityType = event.type === "ADD" ? "add_liquidity" : "remove_liquidity";
    items.push({
      id: event.eventKey,
      txHash: event.txHash as `0x${string}`,
      marketAddress: market.marketAddress as `0x${string}`,
      question: market.question,
      actor: event.provider as `0x${string}`,
      type,
      amount: event.collateralAmount,
      timestamp: event.timestamp.getTime(),
      whale: event.collateralAmount >= 250_000_000n
    });
  }

  for (const redemption of redemptions) {
    items.push({
      id: redemption.eventKey,
      txHash: redemption.txHash as `0x${string}`,
      marketAddress: market.marketAddress as `0x${string}`,
      question: market.question,
      actor: redemption.redeemer as `0x${string}`,
      type: "redeemed",
      amount: redemption.payoutAmount,
      timestamp: redemption.timestamp.getTime(),
      whale: redemption.payoutAmount >= 100_000_000n
    });
  }

  for (const event of oracleEvents) {
    const type: ActivityType =
      event.type === "REQUESTED" || event.type === "FAILED"
        ? "resolution_requested"
        : "resolution_fulfilled";
    items.push({
      id: event.eventKey,
      txHash: event.txHash as `0x${string}`,
      marketAddress: market.marketAddress as `0x${string}`,
      question: market.question,
      actor: market.marketAddress as `0x${string}`,
      type,
      amount: 0n,
      outcome: event.outcome ?? undefined,
      settlementPrice: event.settlementPrice ?? undefined,
      summary: event.summary,
      timestamp: event.timestamp.getTime(),
      whale: false
    });
  }

  const serializedItems = items
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, limit)
    .map(serializeActivityItem);

  const nextCursor =
    serializedItems.length === limit
      ? String(serializedItems[serializedItems.length - 1]?.timestamp ?? "")
      : null;

  return {
    items: serializedItems,
    nextCursor
  };
}
