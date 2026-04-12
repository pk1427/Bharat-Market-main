import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

import { chainlinkFunctionsOracleAbi } from "@/lib/abis";
import { getRequiredAddresses } from "@/lib/contracts";
import {
  fetchMarketDetail,
  serializeMarketDetail
} from "@/lib/market-data";
import { getCachedDetail, setCachedDetail } from "@/lib/server/market-cache";
import { getServerPublicClient } from "@/lib/server/public-client";

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

  try {
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

    await setCachedDetail(marketAddress, account, payload, pendingRequest);

    return NextResponse.json({
      market: payload,
      pendingRequest,
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
