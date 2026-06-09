import { NextRequest, NextResponse } from "next/server";
import { getAddress, isHash } from "viem";

import { getPrismaClient } from "@/backend/db/client";
import { getIndexerPublicClient } from "@/backend/indexer/client";
import {
  syncCreatedMarketFromTransaction,
  syncSingleMarketIndexer
} from "@/backend/indexer/core";
import { runIndexerSync } from "@/backend/services/indexer-runner";
import { getRequiredAddresses } from "@/lib/contracts";

type SyncMode = "market" | "create" | "oracle";

export async function POST(request: NextRequest) {
  const prisma = getPrismaClient();
  const addresses = getRequiredAddresses();

  if (!prisma) {
    return NextResponse.json({ error: "DATABASE_URL is missing." }, { status: 500 });
  }

  if (!addresses) {
    return NextResponse.json({ error: "Required contract addresses are missing." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as {
    txHash?: string;
    marketAddress?: string;
    mode?: SyncMode;
  } | null;

  const txHash = body?.txHash;
  if (!txHash || !isHash(txHash)) {
    return NextResponse.json({ error: "Missing or invalid transaction hash." }, { status: 400 });
  }

  const mode: SyncMode =
    body?.mode === "create" || body?.mode === "oracle" ? body.mode : "market";

  try {
    if (mode === "oracle") {
      const result = await runIndexerSync("manual");
      return NextResponse.json({
        status: "oracle_synced",
        txHash,
        result
      });
    }

    if (mode === "create") {
      const result = await syncCreatedMarketFromTransaction({
        prisma,
        publicClient: getIndexerPublicClient(),
        marketFactory: addresses.marketFactory,
        txHash: txHash as `0x${string}`
      });

      return NextResponse.json(result);
    }

    const marketAddress = body?.marketAddress;
    let normalizedMarketAddress: `0x${string}` | null = null;
    try {
      normalizedMarketAddress = marketAddress ? getAddress(marketAddress) : null;
    } catch {
      normalizedMarketAddress = null;
    }

    if (!normalizedMarketAddress) {
      return NextResponse.json({ error: "Missing or invalid market address." }, { status: 400 });
    }

    const market = await prisma.market.findUnique({
      where: { marketAddress: normalizedMarketAddress.toLowerCase() },
      select: { createdBlock: true }
    });

    const receipt = await getIndexerPublicClient().getTransactionReceipt({
      hash: txHash as `0x${string}`
    });

    if (receipt.status !== "success") {
      throw new Error("Transaction did not succeed.");
    }

    const result = await syncSingleMarketIndexer({
      prisma,
      publicClient: getIndexerPublicClient(),
      marketAddress: normalizedMarketAddress,
      floorBlock: receipt.blockNumber > 250n ? receipt.blockNumber - 250n : 0n,
      safeHead: receipt.blockNumber,
      createdBlockHint: market?.createdBlock ?? undefined
    });

    return NextResponse.json({
      status: "market_synced",
      txHash,
      marketAddress: normalizedMarketAddress,
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync market transaction."
      },
      { status: 500 }
    );
  }
}
