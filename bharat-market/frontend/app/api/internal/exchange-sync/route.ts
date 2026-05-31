import { NextRequest, NextResponse } from "next/server";

import { runIndexerSync } from "@/backend/services/indexer-runner";
import { runResolutionSync } from "@/backend/services/resolution-runner";

function isAuthorized(request: NextRequest) {
  const secrets = [
    process.env.EXCHANGE_SYNC_SECRET,
    process.env.RESOLUTION_CRON_SECRET,
    process.env.INDEXER_CRON_SECRET,
    process.env.CRON_SECRET
  ].filter((value): value is string => Boolean(value));
  if (secrets.length === 0) {
    return false;
  }

  const bearer = request.headers.get("authorization");
  const direct =
    request.headers.get("x-exchange-secret") ||
    request.headers.get("x-resolution-secret") ||
    request.headers.get("x-indexer-secret");

  return secrets.some((secret) => bearer === `Bearer ${secret}` || direct === secret);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resolution = await runResolutionSync("cron");
    const indexer = await runIndexerSync("cron");

    return NextResponse.json({
      status: "exchange_synced",
      resolution,
      indexer
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run exchange sync."
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
