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

const cacheDir = path.join(process.cwd(), ".cache");
const cacheFile = path.join(cacheDir, "market-cache.json");

const emptyCache: CacheFile = {
  summaries: null,
  details: {}
};

async function ensureCacheDir() {
  await mkdir(cacheDir, { recursive: true });
}

export async function readMarketCache() {
  try {
    const raw = await readFile(cacheFile, "utf8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    return emptyCache;
  }
}

export async function writeMarketCache(cache: CacheFile) {
  await ensureCacheDir();
  await writeFile(cacheFile, JSON.stringify(cache, null, 2), "utf8");
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
