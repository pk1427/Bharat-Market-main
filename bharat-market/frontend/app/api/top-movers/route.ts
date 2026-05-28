import { buildApiMeta } from "@/backend/api/response";
import { NextRequest, NextResponse } from "next/server";

import { parsePositiveInt } from "@/backend/api/pagination";
import { listTopMovers } from "@/backend/services/markets";

export async function GET(request: NextRequest) {
  const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10, 25);
  const movers = await listTopMovers(limit);

  return NextResponse.json({
    markets: movers ?? [],
    meta: buildApiMeta({
      source: movers !== null ? "indexed" : "rpc",
      indexed: movers !== null
    })
  });
}
