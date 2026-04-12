"use client";

import { useEffect, useState } from "react";

import { MarketCard } from "@/components/market-card";
import {
  deserializeMarketSummary,
  type MarketSummary,
  type MarketSummaryDto
} from "@/lib/market-data";

export function MarketList({ externalRefreshTick = 0 }: { externalRefreshTick?: number }) {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadMarkets() {
      try {
        setLoading(true);
        setError(null);
        setWarning(null);
        const response = await fetch(`/api/markets?refresh=${Date.now()}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          markets?: MarketSummaryDto[];
          error?: string;
          warning?: string;
        };

        if (!response.ok || !payload.markets) {
          throw new Error(payload.error ?? "Failed to load markets.");
        }

        const data = payload.markets.map(deserializeMarketSummary);

        if (!cancelled) {
          setMarkets(data);
          setWarning(payload.warning ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load markets.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMarkets();

    return () => {
      cancelled = true;
    };
  }, [refreshTick, externalRefreshTick]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, 45000);

    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="glass h-72 animate-pulse rounded-[28px] border border-white/5 bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-[28px] border border-coral/20 bg-coral/10 p-6 text-sm text-coral">
        {error}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="glass rounded-[28px] p-8 text-center text-slate-300">
        No markets found yet. Create one with your Hardhat scripts and it will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {warning ? (
        <div className="glass rounded-[20px] border border-gold/20 bg-gold/10 p-4 text-sm text-gold">
          RPC is unstable, so this board is showing cached backend data.
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setRefreshTick((value) => value + 1)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 transition hover:border-white/20 hover:text-white"
        >
          Refresh Markets
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {markets.map((market) => (
          <MarketCard key={market.address} market={market} />
        ))}
      </div>
    </div>
  );
}

export type MarketListHandle = {
  refresh: () => void;
};
