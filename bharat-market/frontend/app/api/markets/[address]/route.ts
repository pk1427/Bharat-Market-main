import { buildApiMeta } from "@/backend/api/response";
import {
  INDEXED_ONLY_WARNING,
  isDashboardRpcFallbackAllowed
} from "@/backend/api/rpc-fallback";
import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

import { getMarketIndexerFreshness } from "@/backend/services/indexer-freshness";
import { getIndexedMarketDetail } from "@/backend/services/markets";
import { chainlinkFunctionsOracleAbi } from "@/lib/abis";
import { getRequiredAddresses } from "@/lib/contracts";
import {
  fetchMarketDetail,
  serializeMarketDetail
} from "@/lib/market-data";
import {
  getCachedDetail,
  isFresh,
  setCachedDetail
} from "@/lib/server/market-cache";
import { getServerPublicClient } from "@/lib/server/public-client";

const DETAIL_TTL_MS = 60_000;

async function buildMarketDetailSnapshot(
  addresses: NonNullable<ReturnType<typeof getRequiredAddresses>>,
  marketAddress: `0x${string}`,
  account?: `0x${string}`
) {
  const publicClient = getServerPublicClient();
  const detail = await fetchMarketDetail(
    publicClient,
    addresses.marketFactory,
    marketAddress,
    addresses.usdc,
    account,
    {
      includeActivityStats: false
    }
  );

  const pendingRequest = addresses.chainlinkOracle
    ? await publicClient.readContract({
        address: addresses.chainlinkOracle,
        abi: chainlinkFunctionsOracleAbi,
        functionName: "marketPendingRequest",
        args: [marketAddress]
      })
    : null;

  const indexed = await getIndexedMarketDetail(marketAddress).catch(() => null);
  const payload = {
    ...serializeMarketDetail(detail),
    ...(indexed?.market
      ? {
          creator: indexed.market.creator,
          question: indexed.market.question,
          volume: indexed.market.volume,
          traderCount: indexed.market.traderCount
        }
      : {})
  };
  const normalizedPendingRequest = typeof pendingRequest === "string" ? pendingRequest : null;

  await setCachedDetail(
    marketAddress,
    account,
    payload,
    normalizedPendingRequest
  );

  return {
    market: payload,
    pendingRequest: normalizedPendingRequest
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const addresses = getRequiredAddresses();

  if (!addresses) {
    return NextResponse.json(
      { error: "Missing frontend env configuration." },
      { status: 500 }
    );
  }

  const { address } = await context.params;
  const marketAddress = getAddress(address);
  const accountParam = request.nextUrl.searchParams.get("account");
  const account = accountParam ? getAddress(accountParam) : undefined;
  const forceFresh = request.nextUrl.searchParams.get("fresh") === "1";
  const allowRpcFallback = isDashboardRpcFallbackAllowed(request);
  const freshness = forceFresh ? null : await getMarketIndexerFreshness(marketAddress);

  try {
    const indexed = await getIndexedMarketDetail(marketAddress, account);
    if (indexed) {
      return NextResponse.json({
        market: indexed.market,
        pendingRequest: indexed.pendingRequest,
        meta: buildApiMeta({
          source: "indexed",
          indexed: true,
          stale: freshness ? !freshness.fresh : false,
          warning: freshness && !freshness.fresh ? freshness.reason : null,
          updatedAt: freshness?.updatedAt ?? undefined
        })
      });
    }

    const cached = await getCachedDetail(marketAddress, account);
    if (!forceFresh && cached) {
      if (allowRpcFallback && !isFresh(cached.updatedAt, DETAIL_TTL_MS)) {
        void buildMarketDetailSnapshot(addresses, marketAddress, account).catch(() => {
          // Keep serving the last good backend snapshot if refresh fails.
        });
      }

      return NextResponse.json({
        market: cached.data,
        pendingRequest: cached.pendingRequest,
        meta: buildApiMeta({
          source: "cache",
          stale: !isFresh(cached.updatedAt, DETAIL_TTL_MS),
          updatedAt: cached.updatedAt,
          fallbackUsed: true,
          warning: freshness && !freshness.fresh ? freshness.reason : null
        })
      });
    }

    if (!allowRpcFallback) {
      return NextResponse.json(
        {
          error: INDEXED_ONLY_WARNING,
          meta: buildApiMeta({
            source: "indexed",
            indexed: true,
            stale: true,
            warning: INDEXED_ONLY_WARNING
          })
        },
        { status: 404 }
      );
    }

    const snapshot = await buildMarketDetailSnapshot(addresses, marketAddress, account);

    return NextResponse.json({
      market: snapshot.market,
      pendingRequest: snapshot.pendingRequest,
      meta: buildApiMeta({
        source: "rpc",
        warning: freshness && !freshness.fresh ? freshness.reason : null
      })
    });
  } catch (error) {
    const cached = await getCachedDetail(marketAddress, account);

    if (cached) {
      return NextResponse.json({
        market: cached.data,
        pendingRequest: cached.pendingRequest,
        meta: buildApiMeta({
          source: "cache",
          stale: true,
          updatedAt: cached.updatedAt,
          warning:
            freshness && !freshness.fresh
              ? freshness.reason
              : error instanceof Error
              ? error.message
              : "RPC unavailable. Showing cached market detail.",
          fallbackUsed: true
        })
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : INDEXED_ONLY_WARNING,
        meta: buildApiMeta({
          source: "indexed",
          indexed: true,
          stale: true,
          warning:
            error instanceof Error
              ? error.message
              : INDEXED_ONLY_WARNING
        })
      },
      { status: 503 }
    );
  }
}
