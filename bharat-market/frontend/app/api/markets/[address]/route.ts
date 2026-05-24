import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

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
    account
  );

  const pendingRequest = addresses.chainlinkOracle
    ? await publicClient.readContract({
        address: addresses.chainlinkOracle,
        abi: chainlinkFunctionsOracleAbi,
        functionName: "marketPendingRequest",
        args: [marketAddress]
      })
    : null;

  const payload = serializeMarketDetail(detail);
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

  try {
    const cached = await getCachedDetail(marketAddress, account);
    if (!forceFresh && cached) {
      if (!isFresh(cached.updatedAt, DETAIL_TTL_MS)) {
        void buildMarketDetailSnapshot(addresses, marketAddress, account).catch(() => {
          // Keep serving the last good backend snapshot if refresh fails.
        });
      }

      return NextResponse.json({
        market: cached.data,
        pendingRequest: cached.pendingRequest,
        stale: !isFresh(cached.updatedAt, DETAIL_TTL_MS),
        updatedAt: cached.updatedAt,
        cached: true
      });
    }

    const snapshot = await buildMarketDetailSnapshot(addresses, marketAddress, account);

    return NextResponse.json({
      market: snapshot.market,
      pendingRequest: snapshot.pendingRequest,
      stale: false,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    const cached = await getCachedDetail(marketAddress, account);

    if (cached) {
      return NextResponse.json({
        market: cached.data,
        pendingRequest: cached.pendingRequest,
        stale: true,
        updatedAt: cached.updatedAt,
        warning:
          error instanceof Error
            ? error.message
            : "RPC unavailable. Showing cached market detail."
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load market details from RPC."
      },
      { status: 503 }
    );
  }
}
