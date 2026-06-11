import type { Address } from "viem";

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

export type MarketStatus = "active" | "awaiting" | "resolved";

export type OracleTransparency = {
  category: string;
  provider: string;
  marketType: string;
  externalId: string | null;
  settlementRule: string;
  verificationSource: string;
  fallbackSource: string | null;
  settlementProvider?: string | null;
  settlementPrice?: string | null;
  settlementObservedAt?: string | null;
  settlementPayloadHash?: string | null;
  settlementSummary?: string | null;
};

export type MarketSummary = {
  address: Address;
  creator: Address | null;
  question: string;
  category: string;
  oracleSource: string;
  oracleType: string;
  oracleQuery: string;
  oracleMetadata: OracleTransparency | null;
  yesProbability: string;
  noProbability: string;
  liquidity: string;
  volume: string;
  traderCount: number;
  endTime: string;
  endTimeLabel: string;
  resolved: boolean;
  status: MarketStatus;
  statusLabel: string;
  resolvedOutcome: number;
};

export type MarketDetail = MarketSummary & {
  yesPool: string;
  noPool: string;
  yesBalance: string;
  noBalance: string;
  lpBalance: string;
  usdcBalance: string;
  yesToken: Address;
  noToken: Address;
  lpToken: Address;
  winningOutcome: number;
  winningLabel: string;
};

export type PortfolioSide = "yes" | "no" | "lp";

export type PortfolioPosition = {
  marketAddress: Address;
  question: string;
  status: MarketStatus;
  statusLabel: string;
  side: PortfolioSide;
  shares: string;
  averageEntryPrice: string | null;
  currentProbability: string;
  estimatedValue: string;
  unrealizedPnl: string;
  redeemable: string;
  liquidityValue?: string | null;
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
  redeemableTotal: string;
};

export type PortfolioOverview = {
  walletUsdcBalance: string;
  yesHoldings: string;
  noHoldings: string;
  lpHoldings: string;
  redeemableWinnings: string;
  activePositions: number;
  estimatedPositionValue: string;
  unrealizedPnl: string;
};

export type MarketsResponse = {
  markets: MarketSummary[];
  total: number;
  meta: ApiMeta;
};

export type MarketResponse = {
  market: MarketDetail;
  pendingRequest: string | null;
  meta: ApiMeta;
};

export type PortfolioResponse = {
  overview: PortfolioOverview;
  groups: PortfolioGroup[];
  updatedAt: string;
  meta: ApiMeta;
};

export type OracleProviderInfo = {
  category: "crypto" | "cricket" | "election";
  provider: string;
};

export type OracleCatalogResponse = {
  providers: OracleProviderInfo[];
  categories: Array<OracleProviderInfo["category"]>;
  supportedMarketTypes: Record<string, string[]>;
};

export type WebhookEventType =
  | "market.created"
  | "market.updated"
  | "trade.executed"
  | "liquidity.added"
  | "liquidity.removed"
  | "market.resolved"
  | "market.redeemed"
  | "oracle.requested"
  | "oracle.fulfilled"
  | "oracle.failed";

export type WebhookSubscription = {
  id: string;
  owner: string | null;
  url: string;
  events: WebhookEventType[];
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type WebhookListResponse = {
  subscriptions: WebhookSubscription[];
};

export type WebhookCreateResponse = {
  subscription: WebhookSubscription;
  secret: string;
};
