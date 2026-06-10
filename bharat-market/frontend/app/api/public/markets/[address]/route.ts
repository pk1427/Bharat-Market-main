import { buildApiMeta } from "@/backend/api/response";
import { getIndexedMarketDetail } from "@/backend/services/markets";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ address: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { address } = await params;
  const marketAddress = address as `0x${string}`;
  const indexedDetail = await getIndexedMarketDetail(marketAddress);

  if (!indexedDetail) {
    return NextResponse.json(
      {
        error: "Market not found.",
        meta: buildApiMeta({
          source: "indexed",
          indexed: true,
          stale: true,
          warning: "Public market detail is unavailable because the indexed backend has no matching market."
        })
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...indexedDetail,
    meta: buildApiMeta({
      source: "indexed",
      indexed: true
    })
  });
}
