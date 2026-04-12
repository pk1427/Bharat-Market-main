import { NextRequest, NextResponse } from "next/server";

const primaryRpcUrl =
  process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const fallbackRpcUrl = "https://rpc-amoy.polygon.technology";

async function forwardRpc(
  request: NextRequest,
  targetUrl: string,
  body: string
) {
  return fetch(targetUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body,
    cache: "no-store"
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  let response = await forwardRpc(request, primaryRpcUrl, body);

  if (!response.ok && response.status === 429 && primaryRpcUrl !== fallbackRpcUrl) {
    response = await forwardRpc(request, fallbackRpcUrl, body);
  }

  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}
