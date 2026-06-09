import { buildApiMeta } from "@/backend/api/response";
import { INDEXED_ONLY_WARNING } from "@/backend/api/rpc-fallback";
import { NextRequest, NextResponse } from "next/server";

import { parsePositiveInt } from "@/backend/api/pagination";
import { listTrendingMarkets } from "@/backend/services/markets";

export async function GET(request: NextRequest) {
  const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10, 25);
  const markets = await listTrendingMarkets(limit);

  return NextResponse.json({
    markets: markets ?? [],
    meta: buildApiMeta({
      source: "indexed",
      indexed: markets !== null,
      stale: markets === null,
      warning: markets === null ? INDEXED_ONLY_WARNING : null
    })
  });
}
