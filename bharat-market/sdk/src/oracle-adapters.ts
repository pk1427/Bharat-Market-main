export type OracleCategory = "crypto" | "cricket" | "election" | "custom";

export type OracleAdapterDescriptor = {
  category: OracleCategory;
  provider: string;
  name: string;
  description: string;
  supportedMarketTypes: string[];
};

export const oracleAdapters: OracleAdapterDescriptor[] = [
  {
    category: "crypto",
    provider: "coingecko",
    name: "CoinGecko",
    description: "Deterministic crypto price settlement for price_above and price_below markets.",
    supportedMarketTypes: ["price_above", "price_below"]
  },
  {
    category: "cricket",
    provider: "cricapi",
    name: "CricAPI",
    description: "Cricket fixture and winner settlement adapter.",
    supportedMarketTypes: ["winner"]
  },
  {
    category: "cricket",
    provider: "api-sports",
    name: "API-Sports",
    description: "Alternative cricket fixture and winner settlement adapter.",
    supportedMarketTypes: ["winner"]
  },
  {
    category: "election",
    provider: "staging",
    name: "Election Staging Adapter",
    description: "Placeholder election settlement adapter for future verified providers.",
    supportedMarketTypes: ["winner"]
  }
];

export function listOracleAdapters(category?: OracleCategory) {
  return category ? oracleAdapters.filter((adapter) => adapter.category === category) : oracleAdapters;
}
