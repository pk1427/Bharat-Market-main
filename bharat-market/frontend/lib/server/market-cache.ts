import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type { MarketDetailDto, MarketSummaryDto } from "@/lib/market-data";

type CacheFile = {
  summaries: {
    updatedAt: string;
    data: MarketSummaryDto[];
  } | null;
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
    const parsed = JSON.parse(raw) as CacheFile;
    globalThis.__bharatMarketCache = parsed;
    return parsed;
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
