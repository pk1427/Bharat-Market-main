import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type { MarketDetailDto, MarketSummaryDto } from "@/lib/market-data";
import type { ActivityItem, HistoryPoint } from "@/types/product";

type CacheFile = {
  summaries: {
    updatedAt: string;
    data: MarketSummaryDto[];
  } | null;
  portfolios: Record<
    string,
    {
      updatedAt: string;
      data: unknown;
    }
  >;
  histories: Record<
    string,
    {
      updatedAt: string;
      data: Array<{
        timestamp: number;
        yesProbability: string;
        noProbability: string;
        volume: string;
        source: HistoryPoint["source"];
      }>;
    }
  >;
  activities: Record<
    string,
    {
      updatedAt: string;
      data: Array<Omit<ActivityItem, "amount" | "shares"> & { amount: string; shares?: string }>;
    }
  >;
  details: Record<
    string,
    {
      updatedAt: string;
      data: MarketDetailDto;
      pendingRequest: string | null;
    }
  >;
};

declare global {
  var __bharatMarketCache: CacheFile | undefined;
}

const cacheDir = path.join(process.cwd(), ".cache");
const cacheFile = path.join(cacheDir, "market-cache.json");
const isVercel = process.env.VERCEL === "1";

function cloneEmptyCache(): CacheFile {
  return {
    summaries: null,
    portfolios: {},
    histories: {},
    activities: {},
    details: {}
  };
}

function getMemoryCache() {
  if (!globalThis.__bharatMarketCache) {
    globalThis.__bharatMarketCache = cloneEmptyCache();
  }

  return globalThis.__bharatMarketCache;
}

async function ensureCacheDir() {
  await mkdir(cacheDir, { recursive: true });
}

export async function readMarketCache() {
  const memoryCache = getMemoryCache();

  if (isVercel) {
    return memoryCache;
  }

  try {
    const raw = await readFile(cacheFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<CacheFile>;
    const normalized: CacheFile = {
      summaries: parsed.summaries ?? null,
      portfolios: parsed.portfolios ?? {},
      histories: parsed.histories ?? {},
      activities: parsed.activities ?? {},
      details: parsed.details ?? {}
    };
    globalThis.__bharatMarketCache = normalized;
    return normalized;
  } catch {
    return memoryCache;
  }
}

export async function writeMarketCache(cache: CacheFile) {
  globalThis.__bharatMarketCache = cache;

  if (isVercel) {
    return;
  }

  try {
    await ensureCacheDir();
    await writeFile(cacheFile, JSON.stringify(cache, null, 2), "utf8");
  } catch {
    // Ignore filesystem cache failures so hosted deployments can still serve live RPC data.
  }
}

export async function getCachedSummaries() {
  const cache = await readMarketCache();
  return cache.summaries;
}

export async function setCachedSummaries(data: MarketSummaryDto[]) {
  const cache = await readMarketCache();
  cache.summaries = {
    updatedAt: new Date().toISOString(),
    data
  };
  await writeMarketCache(cache);
}

export async function getCachedDetail(address: string, account?: string | null) {
  const cache = await readMarketCache();
  return cache.details[getDetailKey(address, account)];
}

export async function setCachedDetail(
  address: string,
  account: string | null | undefined,
  data: MarketDetailDto,
  pendingRequest: string | null
) {
  const cache = await readMarketCache();
  cache.details[getDetailKey(address, account)] = {
    updatedAt: new Date().toISOString(),
    data,
    pendingRequest
  };
  await writeMarketCache(cache);
}

function getDetailKey(address: string, account?: string | null) {
  return `${address.toLowerCase()}:${account?.toLowerCase() ?? "anon"}`;
}

export async function getCachedPortfolio(account: string) {
  const cache = await readMarketCache();
  return cache.portfolios[account.toLowerCase()];
}

export async function setCachedPortfolio(account: string, data: unknown) {
  const cache = await readMarketCache();
  cache.portfolios[account.toLowerCase()] = {
    updatedAt: new Date().toISOString(),
    data
  };
  await writeMarketCache(cache);
}

export function isFresh(updatedAt: string, maxAgeMs: number) {
  return Date.now() - Date.parse(updatedAt) <= maxAgeMs;
}

export async function getCachedHistory(address: string) {
  const cache = await readMarketCache();
  return cache.histories[address.toLowerCase()];
}

export async function setCachedHistory(
  address: string,
  data: Array<{
    timestamp: number;
    yesProbability: string;
    noProbability: string;
    volume: string;
    source: HistoryPoint["source"];
  }>
) {
  const cache = await readMarketCache();
  cache.histories[address.toLowerCase()] = {
    updatedAt: new Date().toISOString(),
    data
  };
  await writeMarketCache(cache);
}

export async function getCachedActivity(address: string) {
  const cache = await readMarketCache();
  return cache.activities[address.toLowerCase()];
}

export async function setCachedActivity(
  address: string,
  data: Array<Omit<ActivityItem, "amount" | "shares"> & { amount: string; shares?: string }>
) {
  const cache = await readMarketCache();
  cache.activities[address.toLowerCase()] = {
    updatedAt: new Date().toISOString(),
    data
  };
  await writeMarketCache(cache);
}
