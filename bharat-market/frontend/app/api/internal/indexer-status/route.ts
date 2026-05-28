import { NextResponse } from "next/server";

import { getIndexerStatus } from "@/backend/services/indexer-status";

export async function GET() {
  const status = await getIndexerStatus();

  if (!status) {
    return NextResponse.json(
      {
        error: "Indexed backend is not configured."
      },
      { status: 503 }
    );
  }

  return NextResponse.json(status);
}
