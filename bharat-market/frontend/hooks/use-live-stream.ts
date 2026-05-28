"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type StreamStatus = "connecting" | "live" | "fallback" | "error";

type StreamMessage = {
  scope: "board" | "market" | "portfolio";
  revision?: string | null;
  mode?: "fallback" | "error";
  updatedAt?: string;
  timestamp: string;
};

function useStreamConnection(
  url: string | null,
  onUpdate: (queryClient: ReturnType<typeof useQueryClient>) => void
) {
  const queryClient = useQueryClient();
  const onUpdateRef = useRef(onUpdate);
  const lastRevisionRef = useRef<string | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!url) {
      return;
    }

    const source = new EventSource(url);
    setStatus("connecting");

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as StreamMessage;
        setLastEventAt(payload.timestamp);

        if (payload.mode === "fallback") {
          setStatus("fallback");
          return;
        }

        if (payload.mode === "error") {
          setStatus("error");
          return;
        }

        setStatus("live");

        if (event.type === "update" && payload.revision && payload.revision !== lastRevisionRef.current) {
          lastRevisionRef.current = payload.revision;
          onUpdateRef.current(queryClient);
        }
      } catch {
        setStatus("error");
      }
    };

    source.addEventListener("ready", handleMessage as EventListener);
    source.addEventListener("update", handleMessage as EventListener);
    source.addEventListener("heartbeat", handleMessage as EventListener);
    source.onerror = () => {
      setStatus("error");
    };

    return () => {
      source.close();
    };
  }, [queryClient, url]);

  return {
    status,
    lastEventAt
  };
}

export function useLiveBoardStream() {
  return useStreamConnection("/api/stream?scope=board", (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: ["market-board"] });
    void queryClient.invalidateQueries({ queryKey: ["board-analytics"] });
    void queryClient.invalidateQueries({ queryKey: ["indexer-status"] });
  });
}

export function useLiveMarketStream(marketAddress: string | null) {
  const url = marketAddress ? `/api/stream?scope=market&market=${marketAddress}` : null;

  return useStreamConnection(url, (queryClient) => {
    void queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        ((query.queryKey[0] === "market-detail" && query.queryKey[1] === marketAddress) ||
          (query.queryKey[0] === "market-history" && query.queryKey[1] === marketAddress) ||
          (query.queryKey[0] === "activity" && query.queryKey[1] === marketAddress))
    });
  });
}

export function useLivePortfolioStream(wallet: string | null) {
  const url = wallet ? `/api/stream?scope=portfolio&wallet=${wallet}` : null;

  return useStreamConnection(url, (queryClient) => {
    void queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        ((query.queryKey[0] === "portfolio" && query.queryKey[1] === wallet) ||
          (query.queryKey[0] === "wallet-summary" && query.queryKey[1] === wallet) ||
          query.queryKey[0] === "indexer-status")
    });
  });
}
