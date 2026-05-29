import { NextRequest, NextResponse } from "next/server";

import { runResolutionSync } from "@/backend/services/resolution-runner";

function isAuthorized(request: NextRequest) {
  const secrets = [process.env.RESOLUTION_CRON_SECRET, process.env.INDEXER_CRON_SECRET, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );
  if (secrets.length === 0) {
    return false;
  }

  const bearer = request.headers.get("authorization");
  const direct = request.headers.get("x-resolution-secret") || request.headers.get("x-indexer-secret");

  return secrets.some((secret) => bearer === `Bearer ${secret}` || direct === secret);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runResolutionSync("cron");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run resolution sync."
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
