import { NextResponse } from "next/server";

import { listOracleProviders } from "@/backend/oracles/registry";

export async function GET() {
  return NextResponse.json({
    providers: listOracleProviders(),
    categories: ["crypto", "cricket", "election"],
    supportedMarketTypes: {
      crypto: ["price_above", "price_below"],
      cricket: ["winner"],
      election: ["winner"]
    }
  });
}
