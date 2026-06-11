import { NextResponse } from "next/server";

import { dispatchPendingWebhookDeliveries } from "@/backend/services/webhooks";

export async function POST(request: Request) {
  const secret = request.headers.get("x-bharatmarket-secret");
  const expected = process.env.EXCHANGE_SYNC_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await dispatchPendingWebhookDeliveries();
  return NextResponse.json({ ok: true, ...result });
}
