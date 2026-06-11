import type {
  ActivityItem,
  PortfolioGroup,
  PortfolioOverview,
  PortfolioPosition,
  PositionSide
} from "@/types/product";
import type { MarketDetailDto, MarketStatus, MarketSummaryDto } from "@/lib/market-data";
import { formatDateTimeIst } from "@/lib/format";
import { getCategoryLabel } from "@/lib/market-meta";
import {
  decodeOracleMetadata,
  getOracleProviderLabel,
  normalizeOracleMetadata,
  summarizeOracleMetadata
} from "@/lib/oracle-metadata";

export function getMarketStatus(resolved: boolean, endTime: Date): MarketStatus {
  const now = Date.now();
  if (resolved) {
    return "resolved";
  }

  return endTime.getTime() <= now ? "awaiting" : "active";
}

export function getStatusLabel(status: MarketStatus) {
  if (status === "active") return "Active";
  if (status === "awaiting") return "Awaiting Resolution";
  return "Resolved";
}

export function getEndTimeLabel(endTime: Date) {
  return formatDateTimeIst(endTime);
}

export function toOutcomeNumber(outcome: "PENDING" | "YES" | "NO" | string) {
  if (outcome === "YES") return 1;
  if (outcome === "NO") return 2;
  return 0;
}

export function toMarketSummaryDto(market: {
  marketAddress: string;
  creator: string | null;
  question: string;
  oracleType: string;
  oracleQuery: string;
  oracleMetadata?: unknown;
  settlementProvider?: string | null;
  settlementPrice?: bigint | number | string | null;
  settlementObservedAt?: Date | null;
  settlementPayloadHash?: string | null;
  settlementSummary?: string | null;
  latestYesProbability: bigint | number | string;
  latestNoProbability: bigint | number | string;
  totalLiquidity: bigint | number | string;
  totalVolume: bigint | number | string;
  traderCount: number;
  endTime: Date;
  resolved: boolean;
  outcome: "PENDING" | "YES" | "NO" | string;
}): MarketSummaryDto {
  const status = getMarketStatus(market.resolved, market.endTime);
  const yesProbability = toBigIntValue(market.latestYesProbability);
  const noProbability = toBigIntValue(market.latestNoProbability);
  const liquidity = toBigIntValue(market.totalLiquidity);
  const volume = toBigIntValue(market.totalVolume);
  const providerMetadata = decodeOracleMetadataFromMarket(market);
  const summarizedMetadata = summarizeOracleMetadata(providerMetadata);
  const oracleMetadata = summarizedMetadata
    ? {
        ...summarizedMetadata,
        settlementProvider: market.settlementProvider ?? null,
        settlementPrice:
          market.settlementPrice !== null && market.settlementPrice !== undefined
            ? toBigIntValue(market.settlementPrice).toString()
            : null,
        settlementObservedAt: market.settlementObservedAt?.toISOString() ?? null,
        settlementPayloadHash: market.settlementPayloadHash ?? null,
        settlementSummary: market.settlementSummary ?? null
      }
    : null;

  return {
    address: market.marketAddress as `0x${string}`,
    creator: market.creator as `0x${string}` | null,
    question: market.question,
    category: getCategoryLabel(market.oracleType, market.oracleQuery),
    oracleSource: getOracleProviderLabel(providerMetadata, market.oracleType),
    oracleType: market.oracleType,
    oracleQuery: market.oracleQuery,
    oracleMetadata,
    yesProbability: yesProbability.toString(),
    noProbability: noProbability.toString(),
    liquidity: liquidity.toString(),
    volume: volume.toString(),
    traderCount: market.traderCount,
    endTime: BigInt(Math.floor(market.endTime.getTime() / 1000)).toString(),
    endTimeLabel: getEndTimeLabel(market.endTime),
    resolved: market.resolved,
    status,
    statusLabel: getStatusLabel(status),
    resolvedOutcome: toOutcomeNumber(market.outcome)
  };
}

export function toMarketDetailDto(params: {
  market: {
    marketAddress: string;
    creator: string | null;
    question: string;
    oracleType: string;
    oracleQuery: string;
    latestYesProbability: bigint | number | string;
    latestNoProbability: bigint | number | string;
    totalLiquidity: bigint | number | string;
    totalVolume: bigint | number | string;
    traderCount: number;
    endTime: Date;
    resolved: boolean;
    outcome: "PENDING" | "YES" | "NO" | string;
    yesPool: bigint | number | string;
    noPool: bigint | number | string;
    yesToken: string | null;
    noToken: string | null;
    lpToken: string | null;
    oracleMetadata?: unknown;
  };
  account?: {
    yesBalance: bigint;
    noBalance: bigint;
    lpBalance: bigint;
    usdcBalance: bigint;
  };
}): MarketDetailDto {
  const summary = toMarketSummaryDto(params.market);
  const winningOutcome = toOutcomeNumber(params.market.outcome);
  return {
    ...summary,
    yesPool: toBigIntValue(params.market.yesPool).toString(),
    noPool: toBigIntValue(params.market.noPool).toString(),
    yesBalance: (params.account?.yesBalance ?? 0n).toString(),
    noBalance: (params.account?.noBalance ?? 0n).toString(),
    lpBalance: (params.account?.lpBalance ?? 0n).toString(),
    usdcBalance: (params.account?.usdcBalance ?? 0n).toString(),
    yesToken: (params.market.yesToken ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    noToken: (params.market.noToken ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    lpToken: (params.market.lpToken ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    winningOutcome,
    winningLabel: winningOutcome === 1 ? "YES" : winningOutcome === 2 ? "NO" : "Pending"
  };
}

function decodeOracleMetadataFromMarket(market: { oracleQuery: string; oracleMetadata?: unknown }) {
  return decodeOracleMetadata(market.oracleQuery) ?? decodeOracleMetadataFromJson(market.oracleMetadata);
}

function decodeOracleMetadataFromJson(value: unknown) {
  return normalizeOracleMetadata(value);
}

function toBigIntValue(value: bigint | number | string) {
  if (typeof value === "bigint") {
    return value;
  }

  return BigInt(value);
}

export function serializeOverview(overview: PortfolioOverview) {
  return {
    ...overview,
    walletUsdcBalance: overview.walletUsdcBalance.toString(),
    yesHoldings: overview.yesHoldings.toString(),
    noHoldings: overview.noHoldings.toString(),
    lpHoldings: overview.lpHoldings.toString(),
    redeemableWinnings: overview.redeemableWinnings.toString(),
    estimatedPositionValue: overview.estimatedPositionValue.toString(),
    unrealizedPnl: overview.unrealizedPnl.toString()
  };
}

export function serializePosition(position: PortfolioPosition) {
  return {
    ...position,
    shares: position.shares.toString(),
    averageEntryPrice: position.averageEntryPrice?.toString() ?? null,
    currentProbability: position.currentProbability.toString(),
    estimatedValue: position.estimatedValue.toString(),
    unrealizedPnl: position.unrealizedPnl.toString(),
    redeemable: position.redeemable.toString(),
    liquidityValue: position.liquidityValue?.toString() ?? null
  };
}

export function serializeGroup(group: PortfolioGroup) {
  return {
    ...group,
    redeemableTotal: group.redeemableTotal.toString(),
    positions: group.positions.map(serializePosition)
  };
}

export function createPosition(params: {
  marketAddress: string;
  question: string;
  status: MarketStatus;
  statusLabel: string;
  side: PositionSide;
  shares: bigint;
  averageEntryPrice: bigint | null;
  currentProbability: bigint;
  estimatedValue: bigint;
  unrealizedPnl: bigint;
  redeemable: bigint;
  oracleType: string;
  category: string;
  liquidityValue?: bigint;
}): PortfolioPosition {
  return {
    marketAddress: params.marketAddress as `0x${string}`,
    question: params.question,
    status: params.status,
    statusLabel: params.statusLabel,
    side: params.side,
    shares: params.shares,
    averageEntryPrice: params.averageEntryPrice,
    currentProbability: params.currentProbability,
    estimatedValue: params.estimatedValue,
    unrealizedPnl: params.unrealizedPnl,
    redeemable: params.redeemable,
    oracleType: params.oracleType,
    category: params.category,
    liquidityValue: params.liquidityValue
  };
}

export function serializeActivityItem(item: ActivityItem) {
  return {
    ...item,
    amount: item.amount.toString(),
    shares: item.shares?.toString(),
    settlementPrice: item.settlementPrice?.toString()
  };
}
