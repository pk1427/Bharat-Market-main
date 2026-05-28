import { NextRequest } from "next/server";

import {
  getBoardLiveState,
  getMarketLiveState,
  getPortfolioLiveState
} from "@/backend/services/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamScope = "board" | "market" | "portfolio";

function encodeSse(event: string, payload: unknown) {
  const json = JSON.stringify(payload);
  return `event: ${event}\ndata: ${json}\n\n`;
}

async function readScopeState(scope: StreamScope, request: NextRequest) {
  if (scope === "board") {
    return getBoardLiveState();
  }

  if (scope === "market") {
    const marketAddress = request.nextUrl.searchParams.get("market");
    if (!marketAddress) {
      return null;
    }

    return getMarketLiveState(marketAddress);
  }

  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return null;
  }

  return getPortfolioLiveState(wallet);
}

export async function GET(request: NextRequest) {
  const scopeParam = request.nextUrl.searchParams.get("scope");
  const scope: StreamScope =
    scopeParam === "market" || scopeParam === "portfolio" ? scopeParam : "board";

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let currentRevision: string | null = null;
      let closed = false;

      const push = async () => {
        const state = await readScopeState(scope, request);

        if (!state) {
          controller.enqueue(
            encoder.encode(
              encodeSse("heartbeat", {
                scope,
                mode: "fallback",
                timestamp: new Date().toISOString()
              })
            )
          );
          return;
        }

        if (currentRevision !== state.revision) {
          currentRevision = state.revision;
          controller.enqueue(
            encoder.encode(
              encodeSse("update", {
                ...state,
                timestamp: new Date().toISOString()
              })
            )
          );
          return;
        }

        controller.enqueue(
          encoder.encode(
            encodeSse("heartbeat", {
              scope,
              revision: currentRevision,
              updatedAt: state.updatedAt,
              timestamp: new Date().toISOString()
            })
          )
        );
      };

      controller.enqueue(
        encoder.encode(
          encodeSse("ready", {
            scope,
            timestamp: new Date().toISOString()
          })
        )
      );

      await push();

      const interval = setInterval(() => {
        if (closed) {
          return;
        }

        void push().catch(() => {
          controller.enqueue(
            encoder.encode(
              encodeSse("heartbeat", {
                scope,
                mode: "error",
                timestamp: new Date().toISOString()
              })
            )
          );
        });
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
