import { NextRequest, NextResponse } from "next/server";
import { isHash } from "viem";

import { getPrismaClient } from "@/backend/db/client";
import { getIndexerPublicClient } from "@/backend/indexer/client";
import { syncCreatedMarketFromTransaction } from "@/backend/indexer/core";
import { getRequiredAddresses } from "@/lib/contracts";

export async function POST(request: NextRequest) {
  const prisma = getPrismaClient();
  const addresses = getRequiredAddresses();

  if (!prisma) {
    return NextResponse.json({ error: "DATABASE_URL is missing." }, { status: 500 });
  }

  if (!addresses) {
    return NextResponse.json({ error: "Required contract addresses are missing." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { txHash?: string } | null;
  const txHash = body?.txHash;

  if (!txHash || !isHash(txHash)) {
    return NextResponse.json({ error: "Missing or invalid transaction hash." }, { status: 400 });
  }

  try {
    const result = await syncCreatedMarketFromTransaction({
      prisma,
      publicClient: getIndexerPublicClient(),
      marketFactory: addresses.marketFactory,
      txHash
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync created market."
      },
      { status: 500 }
    );
  }
}
