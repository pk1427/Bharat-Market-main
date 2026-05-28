import type { Address } from "viem";

import type { MarketStatus } from "@/lib/market-data";

export type PositionSide = "yes" | "no" | "lp";

export type PortfolioPosition = {
  marketAddress: Address;
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
  liquidityValue?: bigint;
  oracleType: string;
  category: string;
};

export type PortfolioGroup = {
  marketAddress: Address;
  question: string;
  status: MarketStatus;
  statusLabel: string;
  category: string;
  oracleType: string;
  positions: PortfolioPosition[];
  redeemableTotal: bigint;
};

export type PortfolioOverview = {
  walletUsdcBalance: bigint;
  yesHoldings: bigint;
  noHoldings: bigint;
  lpHoldings: bigint;
  redeemableWinnings: bigint;
  activePositions: number;
  estimatedPositionValue: bigint;
  unrealizedPnl: bigint;
};

export type PortfolioResponse = {
  overview: PortfolioOverview;
  groups: PortfolioGroup[];
  updatedAt: string;
  stale?: boolean;
  warning?: string | null;
};

export type ApiDataSource = "indexed" | "cache" | "rpc";

export type ApiMeta = {
  source: ApiDataSource;
  stale: boolean;
  updatedAt: string;
  warning?: string | null;
  indexed?: boolean;
  fallbackUsed?: boolean;
  cursor?: string | null;
  hasMore?: boolean;
  range?: "1H" | "24H" | "ALL";
};

export type ActivityType =
  | "buy_yes"
  | "buy_no"
  | "add_liquidity"
  | "remove_liquidity"
  | "market_created"
  | "resolution_requested"
  | "resolution_fulfilled"
  | "redeemed";

export type ActivityItem = {
  id: string;
  txHash: `0x${string}`;
  marketAddress: Address;
  question: string;
  actor: Address;
  type: ActivityType;
  amount: bigint;
  shares?: bigint;
  outcome?: number;
  timestamp: number;
  whale: boolean;
};

export type HistoryPoint = {
  timestamp: number;
  yesProbability: bigint;
  noProbability: bigint;
  volume: bigint;
  source: "local" | "event";
};
