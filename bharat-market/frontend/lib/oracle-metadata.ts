export type OracleCategory = "crypto" | "cricket" | "election";

export type OracleMetadataBase = {
  category: OracleCategory;
  provider: string;
  marketType: string;
  externalId?: string;
  settlementRule: string;
  verificationSource: string;
  fallbackSource?: string;
};

export type CryptoOracleMetadata = OracleMetadataBase & {
  category: "crypto";
  provider: "coingecko";
  asset: string;
  marketType: "price_above" | "price_below";
  targetPrice: number;
  settlementTimestamp: number;
};

export type CricketOracleMetadata = OracleMetadataBase & {
  category: "cricket";
  provider: "cricapi" | "api-sports" | "the-odds-api";
  marketType: "winner";
  matchId: string;
  league?: string;
  teamA: string;
  teamB: string;
  selectedTeam: string;
};

export type ElectionOracleMetadata = OracleMetadataBase & {
  category: "election";
  provider: "staging" | "newsapi";
  marketType: "winner";
  electionId: string;
  candidate: string;
  region?: string;
  electionType?: string;
};

export type OracleMetadata = CryptoOracleMetadata | CricketOracleMetadata | ElectionOracleMetadata;

const ORACLE_METADATA_PREFIX = "bm:v1:";

export function encodeOracleMetadata(metadata: OracleMetadata) {
  return `${ORACLE_METADATA_PREFIX}${base64UrlEncode(JSON.stringify(metadata))}`;
}

export function decodeOracleMetadata(value: string): OracleMetadata | null {
  if (!value.startsWith(ORACLE_METADATA_PREFIX)) {
    return legacyOracleMetadata(value);
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(value.slice(ORACLE_METADATA_PREFIX.length)));
    return normalizeOracleMetadata(parsed);
  } catch {
    return null;
  }
}

export function normalizeOracleMetadata(value: unknown): OracleMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as Record<string, unknown>;
  if (input.category === "crypto") {
    const asset = stringValue(input.asset).toUpperCase();
    const targetPrice = numberValue(input.targetPrice);
    const settlementTimestamp = integerValue(input.settlementTimestamp);
    const marketType = normalizeMarketType(input.marketType);
    const externalId = normalizeCoinGeckoId(input.externalId || input.asset);

    if (!asset || !targetPrice || !settlementTimestamp || !["price_above", "price_below"].includes(marketType)) {
      return null;
    }

    return {
      category: "crypto",
      provider: "coingecko",
      asset,
      marketType: marketType as CryptoOracleMetadata["marketType"],
      targetPrice,
      settlementTimestamp,
      externalId,
      settlementRule: stringValue(input.settlementRule) || `${asset} ${marketType.includes("above") ? ">=" : "<="} ${targetPrice} USD at expiry`,
      verificationSource: stringValue(input.verificationSource) || "CoinGecko market chart range endpoint",
      fallbackSource: stringValue(input.fallbackSource) || undefined
    };
  }

  if (input.category === "cricket") {
    const matchId = stringValue(input.matchId || input.externalId);
    const teamA = stringValue(input.teamA).toUpperCase();
    const teamB = stringValue(input.teamB).toUpperCase();
    const selectedTeam = stringValue(input.selectedTeam || input.teamA).toUpperCase();

    if (!matchId || !teamA || !teamB || !selectedTeam) {
      return null;
    }

    return {
      category: "cricket",
      provider: providerValue(input.provider, "cricapi") as CricketOracleMetadata["provider"],
      marketType: "winner",
      matchId,
      externalId: matchId,
      league: stringValue(input.league) || undefined,
      teamA,
      teamB,
      selectedTeam,
      settlementRule: stringValue(input.settlementRule) || `${selectedTeam} must be the official match winner`,
      verificationSource: stringValue(input.verificationSource) || "Cricket score provider match result",
      fallbackSource: stringValue(input.fallbackSource) || "Secondary sports score provider"
    };
  }

  if (input.category === "election") {
    const electionId = stringValue(input.electionId || input.externalId);
    const candidate = stringValue(input.candidate);

    if (!electionId || !candidate) {
      return null;
    }

    return {
      category: "election",
      provider: providerValue(input.provider, "staging") as ElectionOracleMetadata["provider"],
      marketType: "winner",
      electionId,
      externalId: electionId,
      candidate,
      region: stringValue(input.region) || undefined,
      electionType: stringValue(input.electionType) || undefined,
      settlementRule: stringValue(input.settlementRule) || `${candidate} must be the verified winner`,
      verificationSource: stringValue(input.verificationSource) || "Verified election results source",
      fallbackSource: stringValue(input.fallbackSource) || "Secondary certified result source"
    };
  }

  return null;
}

export function buildOracleQuestion(metadata: OracleMetadata) {
  if (metadata.category === "crypto") {
    const direction = metadata.marketType.includes("above") ? "above" : "below";
    return `Will ${metadata.asset} be ${direction} $${formatTarget(metadata.targetPrice)} at settlement?`;
  }

  if (metadata.category === "cricket") {
    return `Will ${metadata.selectedTeam} beat ${metadata.selectedTeam === metadata.teamA ? metadata.teamB : metadata.teamA}?`;
  }

  return `Will ${metadata.candidate} win ${metadata.region ? `${metadata.region} ` : ""}${metadata.electionType || "the election"}?`;
}

export function getOracleProviderLabel(metadata: OracleMetadata | null, oracleType?: string) {
  if (!metadata) {
    if (oracleType === "crypto" || oracleType === "sports") {
      return "Chainlink Functions";
    }

    return "Oracle";
  }

  if (metadata.provider === "coingecko") {
    return "CoinGecko + Chainlink Functions";
  }

  const provider = metadata.provider
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return `${provider} + Chainlink Functions`;
}

export function summarizeOracleMetadata(metadata: OracleMetadata | null) {
  if (!metadata) {
    return null;
  }

  return {
    category: metadata.category,
    provider: metadata.provider,
    marketType: metadata.marketType,
    externalId: metadata.externalId ?? null,
    settlementRule: metadata.settlementRule,
    verificationSource: metadata.verificationSource,
    fallbackSource: metadata.fallbackSource ?? null
  };
}

function legacyOracleMetadata(oracleQuery: string): OracleMetadata | null {
  if (oracleQuery.endsWith("_price")) {
    const asset = oracleQuery.replace("_price", "").toUpperCase();
    return normalizeOracleMetadata({
      category: "crypto",
      provider: "coingecko",
      asset,
      marketType: "price_above",
      targetPrice: asset === "BTC" ? 100000 : 5000,
      settlementTimestamp: Math.floor(Date.now() / 1000),
      externalId: asset.toLowerCase()
    });
  }

  if (oracleQuery.includes("_vs_")) {
    const [teamA, teamB] = oracleQuery.split("_vs_");
    return normalizeOracleMetadata({
      category: "cricket",
      provider: "the-odds-api",
      matchId: oracleQuery,
      teamA,
      teamB,
      selectedTeam: teamA
    });
  }

  return null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function integerValue(value: unknown) {
  const parsed = Math.floor(numberValue(value));
  return parsed > 0 ? parsed : 0;
}

function providerValue(value: unknown, fallback: string) {
  return stringValue(value) || fallback;
}

function normalizeMarketType(value: unknown) {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "price_above" || normalized === "price_below") {
    return normalized;
  }
  return normalized.replace(/^price_/, "").replace("above", "price_above").replace("below", "price_below");
}

function normalizeCoinGeckoId(value: unknown) {
  const raw = stringValue(value).toLowerCase();
  const ids: Record<string, string> = {
    btc: "bitcoin",
    bitcoin: "bitcoin",
    eth: "ethereum",
    ethereum: "ethereum",
    sol: "solana",
    solana: "solana",
    usdc: "usd-coin",
    "usd-coin": "usd-coin"
  };
  return ids[raw] ?? raw;
}

function formatTarget(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1 ? 0 : 4
  }).format(value);
}

function base64UrlEncode(value: string) {
  if (typeof window === "undefined") {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  if (typeof window === "undefined") {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}
