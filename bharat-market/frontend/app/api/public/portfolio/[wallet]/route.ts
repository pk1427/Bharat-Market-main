import { buildApiMeta } from "@/backend/api/response";
import { getIndexedPortfolio } from "@/backend/services/portfolio";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ wallet: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { wallet } = await params;
  const portfolio = await getIndexedPortfolio(wallet as `0x${string}`);

  if (!portfolio) {
    return NextResponse.json(
      {
        error: "Portfolio not found.",
        meta: buildApiMeta({
          source: "indexed",
          indexed: true,
          stale: true,
          warning: "Public portfolio API is unavailable because the indexed backend has no matching wallet."
        })
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...portfolio,
    meta: buildApiMeta({
      source: "indexed",
      indexed: true
    })
  });
}
