import { buildApiMeta } from "@/backend/api/response";
import { getIndexedMarketBoardPage } from "@/backend/services/markets";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const search = requestUrl.searchParams.get("search");
  const statusParam = requestUrl.searchParams.get("status");
  const status =
    statusParam === "live" || statusParam === "awaiting" || statusParam === "resolved" || statusParam === "all"
      ? statusParam
      : null;
  const limit = Number(requestUrl.searchParams.get("limit") ?? "100");
  const offset = Number(requestUrl.searchParams.get("offset") ?? "0");

  const indexedPage = await getIndexedMarketBoardPage({
    search,
    status,
    take: Number.isFinite(limit) ? Math.min(limit, 100) : 100,
    skip: Number.isFinite(offset) ? Math.max(offset, 0) : 0
  });

  if (!indexedPage) {
    return NextResponse.json(
      {
        markets: [],
        total: 0,
        meta: buildApiMeta({
          source: "indexed",
          indexed: true,
          stale: true,
          warning: "Public market API is unavailable because the indexed backend is not configured."
        })
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    markets: indexedPage.markets,
    total: indexedPage.total,
    meta: buildApiMeta({
      source: "indexed",
      indexed: true,
      hasMore: offset + indexedPage.markets.length < indexedPage.total
    })
  });
}
