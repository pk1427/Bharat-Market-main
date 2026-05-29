import type { CryptoOracleMetadata, OracleMetadata } from "@/lib/oracle-metadata";
import {
  hashOraclePayload,
  resolveCryptoOutcome,
  validateCommonMetadata
} from "@/backend/oracles/outcome-engine";
import { OracleProviderError, type OracleProviderAdapter } from "@/backend/oracles/types";

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  BITCOIN: "bitcoin",
  ETH: "ethereum",
  ETHEREUM: "ethereum",
  SOL: "solana",
  SOLANA: "solana",
  USDC: "usd-coin",
  "USD-COIN": "usd-coin"
};

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const SETTLEMENT_WINDOW_SECONDS = 10 * 60;

export const cryptoOracleProvider: OracleProviderAdapter = {
  category: "crypto",
  provider: "coingecko",
  describe(metadata) {
    const crypto = metadata as CryptoOracleMetadata;
    return `${crypto.asset} ${crypto.marketType.includes("above") ? ">=" : "<="} ${crypto.targetPrice} USD via CoinGecko`;
  },
  validate(metadata) {
    if (metadata.category !== "crypto") return ["Crypto provider received non-crypto metadata."];
    const crypto = metadata as CryptoOracleMetadata;
    const id = resolveCoinGeckoId(crypto);
    return [
      ...validateCommonMetadata(metadata),
      ...(!crypto.asset ? ["Crypto asset is required."] : []),
      ...(!id ? ["Supported CoinGecko asset is required: ethereum, bitcoin, solana, or usd-coin."] : []),
      ...(!["price_above", "price_below"].includes(crypto.marketType) ? ["Crypto market type must be PRICE_ABOVE or PRICE_BELOW."] : []),
      ...(crypto.targetPrice <= 0 ? ["Target price must be greater than zero."] : []),
      ...(crypto.settlementTimestamp <= 0 ? ["Settlement timestamp is required."] : [])
    ];
  },
  async evaluate(metadata) {
    if (metadata.category !== "crypto") {
      throw new OracleProviderError("Crypto adapter can only evaluate crypto metadata.", "INVALID_CATEGORY");
    }

    const crypto = metadata as CryptoOracleMetadata;
    const id = resolveCoinGeckoId(crypto);
    if (!id) {
      throw new OracleProviderError("Unsupported CoinGecko crypto asset.", "UNSUPPORTED_ASSET");
    }

    const settlement = await fetchCoinGeckoSettlementPrice(id, crypto.settlementTimestamp);
    const price = settlement.price;

    const outcome = resolveCryptoOutcome(crypto, price);
    return {
      ...outcome,
      provider: "coingecko",
      externalId: id,
      settlementPrice: price,
      payloadHash: hashOraclePayload(settlement.payload),
      observedAt: new Date(settlement.observedAt * 1000).toISOString(),
      payloadPreview: {
        id,
        endpoint: settlement.endpoint,
        settlementTimestamp: crypto.settlementTimestamp,
        observedAt: settlement.observedAt,
        usd: price
      }
    };
  }
};

export function isCryptoMetadata(metadata: OracleMetadata): metadata is CryptoOracleMetadata {
  return metadata.category === "crypto";
}

function resolveCoinGeckoId(metadata: CryptoOracleMetadata) {
  const candidates = [metadata.externalId, metadata.asset];
  for (const candidate of candidates) {
    const key = String(candidate ?? "").trim().toUpperCase();
    if (COINGECKO_IDS[key]) {
      return COINGECKO_IDS[key];
    }
  }
  return null;
}

async function fetchCoinGeckoSettlementPrice(id: string, settlementTimestamp: number) {
  const from = settlementTimestamp;
  const to = settlementTimestamp + SETTLEMENT_WINDOW_SECONDS;
  const endpoint = `${COINGECKO_BASE_URL}/coins/${encodeURIComponent(id)}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new OracleProviderError(`CoinGecko range request failed with ${response.status}.`, "PROVIDER_HTTP_ERROR");
  }

  const payload = (await response.json()) as { prices?: Array<[number, number]> };
  const pricePoint = payload.prices?.find(([timestampMs, price]) => {
    return timestampMs >= settlementTimestamp * 1000 && Number.isFinite(price);
  });

  if (!pricePoint) {
    throw new OracleProviderError("CoinGecko did not return a deterministic settlement price in the expiry window.", "MISSING_SETTLEMENT_PRICE");
  }

  return {
    endpoint,
    payload,
    observedAt: Math.floor(pricePoint[0] / 1000),
    price: pricePoint[1]
  };
}
